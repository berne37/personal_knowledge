import { openDB } from 'idb'
import { defineStore } from 'pinia'
import { isProxy, ref, toRaw } from 'vue'
import type { Attachment, KnowledgeItem, Note } from '@/types'
// chats: 附件 OPFS 快照（方案③）——句柄权限重启会被收，字节抄进 OPFS 兜底显示
import { deleteSnapshot, saveSnapshot } from '@/services/attachmentSnapshot'

// 初始化 IndexedDB（版本 2）
const dbPromise = openDB('knowledgeDB', 2, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('items')) {
      db.createObjectStore('items', { keyPath: 'id', autoIncrement: true })
    }
  },
})

export const useKnowledgeStore = defineStore('knowledge', () => {
  // 🔧 修复：调用方可能把 Vue 响应式代理直接传进来（如详情页 persistRelations 传的
  // ref 数组）。IndexedDB 写入前要做结构化克隆，Proxy 克隆不了，会抛
  // DataCloneError 且是静默失败（Uncaught in promise）——界面上看似成功，
  // 刷新后数据才消失。这里在 store 门口统一剥掉代理：toRaw 返回的是
  // reactive 包装前的原始对象/数组，元素都是原始值，到这一步已可安全克隆。
  // 堵在 store 层而不是各调用点，是因为任何现在或将来往库里写数据的路径
  // 都可能踩同一个坑（loadItems 里已修过一次同族问题）。
  function stripProxy<T>(value: T): T {
    return (isProxy(value) ? toRaw(value) : value) as T
  }

  const items = ref<KnowledgeItem[]>([])

  // chats: loadItems 单飞——store 初始化(本文件末尾)与详情页 loadItem 会并发调用，
  // 共用同一个 Promise 避免两次 db.getAll 互相覆盖 items.value 造成竞态（表现为刷新详情页查不到条目）。
  let loadItemsPromise: Promise<void> | null = null

  // chats: 单飞版 loadItems——首个调用发起加载并缓存 Promise，后续调用直接复用，
  // 杜绝并发时 items.value 被两次 db.getAll 覆盖。
  async function loadItems() {
    if (loadItemsPromise) return loadItemsPromise
    loadItemsPromise = (async () => {
      const db = await dbPromise
      // chats: 先用本地 plain 变量接收数据，fillId 与回写都操作它；不要直接 put items.value，
      //   因为 items.value 是 Vue 包过的 reactive proxy，IndexedDB 结构化克隆会抛
      //   DataCloneError（#<Object> could not be cloned）。赋值给 items.value 之后再交给 Vue 自动包 reactive。
      const allItems = await db.getAll('items')

      // chats: 子条目已下线——老数据里残留的 children 数组在加载时顺手清掉并回写，
      // 这就是「删不干净」的自动清理：不需要用户手动跑脚本
      let changed = false
      for (const item of allItems) {
        if (item.children?.length) changed = true
        delete item.children

        // chats: 笔记一对多迁移——旧数据 notes 是单个字符串，包成一篇 Note：
        // 标题取第一行（与导图素材的「标题行」约定一致），日期沿用条目的最后更新日
        if (typeof (item as { notes?: unknown }).notes === 'string') {
          changed = true
          const legacy = (item as { notes: string }).notes
          const title =
            legacy
              .trim()
              .split('\n')
              .map((l) => l.trim())
              .find(Boolean) || '笔记'
          item.notes = [
            {
              id: crypto.randomUUID(),
              title: title.slice(0, 50),
              content: legacy,
              date: item.updatedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10),
              createdAt: item.updatedAt || new Date().toISOString(),
              updatedAt: item.updatedAt || new Date().toISOString(),
            },
          ]
        }
      }
      // chats: put 的是 plain 的 allItems（含 FileSystemFileHandle 等可被结构化克隆的原生对象），不再过 reactive
      if (changed) {
        for (const item of allItems) await db.put('items', item)
      }

      items.value = allItems
      items.value.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    })().finally(() => {
      // 加载结束后清空缓存，下次刷新/重新打开仍能重新读取
      loadItemsPromise = null
    })
    return loadItemsPromise
  }

  // 添加条目
  async function addItem(
    item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>,
  ) {
    const db = await dbPromise
    const newItem: KnowledgeItem = {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [],
    }
    await db.add('items', newItem)
    await loadItems()
  }

  // 添加附件
  async function addAttachment(itemId: number, file: File) {
    const db = await dbPromise
    const item = await db.get('items', itemId)
    if (!item) return

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const attachment: Attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      data: dataUrl,
      size: file.size,
      dateAdded: new Date().toISOString(),
    }

    if (!item.attachments) item.attachments = []
    item.attachments.push(attachment)
    item.updatedAt = new Date().toISOString()

    await db.put('items', item)
    await loadItems()
  }

  // 用 File System Access API 添加附件（local-first 核心：只存文件句柄，不存内容）
  // 浏览器不支持 showOpenFilePicker 时由视图层降级到 addAttachment（Base64）
  async function addAttachmentByHandle(itemId: number, handle: FileSystemFileHandle) {
    const db = await dbPromise
    const item = await db.get('items', itemId)
    if (!item) return

    // 句柄本身不读内容，只在入库时取一次元信息（名字/类型/大小）
    const file = await handle.getFile()
    const attachment: Attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      handle,
      size: file.size,
      dateAdded: new Date().toISOString(),
    }
    // chats: 上传当场把字节抄一份进 OPFS（刚授权完正是能读的时候）——
    // 重启后句柄权限被收，靠这份快照显示缩略图。抄失败（老浏览器）不挡入库
    attachment.snapshot = await saveSnapshot(attachment.id, file)

    if (!item.attachments) item.attachments = []
    item.attachments.push(attachment)
    item.updatedAt = new Date().toISOString()

    await db.put('items', item)
    await loadItems()
  }

  // 删除附件
  async function removeAttachment(itemId: number, attachmentId: string) {
    const db = await dbPromise
    const item = await db.get('items', itemId)
    if (!item) return

    item.attachments = (item.attachments || []).filter((a: Attachment) => a.id !== attachmentId)
    item.updatedAt = new Date().toISOString()

    // chats: OPFS 里的快照字节一起清，不然删一次附件留一份孤儿文件
    await deleteSnapshot(attachmentId)

    await db.put('items', item)
    await loadItems()
  }

  // chats: 快照元信息回写（「跟着更新」的落点）——解析预览时发现原文件
  // lastModified/size 对不上就重抄快照，然后调这里把新元信息存回附件。
  // 直改直存不走 updateItem：这属于内部元数据维护，不该碰 updatedAt
  async function updateAttachmentSnapshot(
    itemId: number,
    attachmentId: string,
    snapshot: { lastModified: number; size: number },
  ) {
    const db = await dbPromise
    const item = await db.get('items', itemId)
    if (!item) return
    const att = (item.attachments || []).find((a: Attachment) => a.id === attachmentId)
    if (!att) return
    att.snapshot = snapshot
    await db.put('items', item)
    await loadItems()
  }

  //递归查找：按标题找条目
  function findItemByTitle(title: string): KnowledgeItem | null {
    // chats: 子条目已下线，条目就是一层平铺列表，直接 find
    return items.value.find((node) => node.title === title) ?? null
  }

  // 按 id 查找条目。路由用 :id，标题可以重复、id 不会，所以按 id 才不会跳错条目。
  function findItemById(id: number): KnowledgeItem | null {
    return items.value.find((node) => node.id === id) ?? null
  }

  // chats: 删除条目——子条目已下线，没有子树要收集，但仍然扫全库剔除
  // 其它条目指向它的 前置/相关 引用，否则会留下「未知条目(#n)」的幽灵关联。
  // 反向的「依赖我的」是读取时动态遍历算出来的，条目没了自然消失。
  async function cleanupGhostRefs(removedIds: number[]) {
    if (!removedIds.length) return
    const db = await dbPromise
    const allItems = await db.getAll('items')
    for (const item of allItems) {
      let isDirty = false
      const pre = item.prerequisites
      if (pre?.length) {
        // 🔧 db.getAll 拿的是无类型记录，pre 是 any，参数必须显式标 number，否则隐式 any 报错
        const filtered = pre.filter((rid: number) => !removedIds.includes(rid))
        if (filtered.length !== pre.length) {
          item.prerequisites = filtered
          isDirty = true
        }
      }
      const rel = item.relatedKnowledge
      if (rel?.length) {
        const filtered = rel.filter((rid: number) => !removedIds.includes(rid))
        if (filtered.length !== rel.length) {
          item.relatedKnowledge = filtered
          isDirty = true
        }
      }
      if (isDirty) await db.put('items', item)
    }
  }

  async function deleteItem(id: number) {
    if (id == null) return // 防止删错条目
    const db = await dbPromise
    await db.delete('items', id)
    await cleanupGhostRefs([id])
    await loadItems()
  }

  // 更新条目（递归查找）
  async function updateItem(id: number, data: Partial<KnowledgeItem>) {
    if (id == null) return // 没 id 直接拒绝，避免 undefined === undefined 误命中
    const db = await dbPromise

    // 🔧 入口处统一剥代理 + 过滤 undefined（见 stripProxy 注释），
    // 下面根条目 / 子条目两条合并路径就不用各自防御
    const plainData = Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, stripProxy(value)]),
    ) as Partial<KnowledgeItem>

    // chats: 子条目已下线，条目只有一层，按 id 直接取直改
    const root = await db.get('items', id)
    if (!root) return
    const updated: KnowledgeItem = {
      ...root,
      ...plainData,
      updatedAt: new Date().toISOString(),
    }
    await db.put('items', updated)
    await loadItems()
  }

  // ===== 笔记一对多 CRUD =====
  // chats: 三个 action 都「算出新数组 → 走 updateItem 持久化」，不改传入对象——
  // 和项目页关联知识的 toggleProjectLink 同一套纪律（给 updateItem 新值，不原地 push）。
  // 读数据用 db.get 拿原始对象而不是 findItemById（返回的是 Vue 代理）：
  // 代理元素混进新数组后，updateItem 的 stripProxy 只剥顶层，IDB 结构化克隆会炸
  // （DataCloneError，和附件当初踩的是同一族坑）。
  // toPlain 再加一道保险：Note 全字段都是字符串，JSON 往返能保证绝对是纯数据，
  // 不管调用方从哪条响应式链路把值带进来都炸不了

  function toPlainNotes(notes: Note[]): Note[] {
    return JSON.parse(JSON.stringify(notes)) as Note[]
  }

  // 新建一篇笔记（title/date 由弹窗收集，content 可空着回来再写）
  async function addNote(itemId: number, data: { title: string; content: string; date: string }) {
    const db = await dbPromise
    const raw = await db.get('items', itemId)
    if (!raw) return
    const now = new Date().toISOString()
    const next: Note[] = toPlainNotes([
      ...(raw.notes ?? []),
      { id: crypto.randomUUID(), ...data, createdAt: now, updatedAt: now },
    ])
    await updateItem(itemId, { notes: next })
  }

  // 修改一篇笔记的标题/正文/日期
  async function updateNote(
    itemId: number,
    noteId: string,
    patch: Partial<Pick<Note, 'title' | 'content' | 'date'>>,
  ) {
    const db = await dbPromise
    const raw = await db.get('items', itemId)
    if (!raw) return
    const now = new Date().toISOString()
    const next: Note[] = toPlainNotes(
      (raw.notes ?? []).map((n: Note) =>
        n.id === noteId ? { ...n, ...patch, updatedAt: now } : n,
      ),
    )
    await updateItem(itemId, { notes: next })
  }

  // 删除一篇笔记
  async function deleteNote(itemId: number, noteId: string) {
    const db = await dbPromise
    const raw = await db.get('items', itemId)
    if (!raw) return
    const next: Note[] = toPlainNotes((raw.notes ?? []).filter((n: Note) => n.id !== noteId))
    await updateItem(itemId, { notes: next })
  }

  loadItems()

  return {
    items,
    loadItems,
    addItem,
    addAttachment,
    addAttachmentByHandle,
    removeAttachment,
    updateAttachmentSnapshot,
    deleteItem,
    updateItem,
    addNote,
    updateNote,
    deleteNote,
    findItemByTitle,
    findItemById,
  }
})
