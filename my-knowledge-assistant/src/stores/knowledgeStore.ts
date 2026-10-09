import { openDB } from 'idb'
import { defineStore } from 'pinia'
import { isProxy, ref, toRaw } from 'vue'
import type { Attachment, KnowledgeItem } from '@/types'

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

  loadItems()

  return {
    items,
    loadItems,
    addItem,
    addAttachment,
    addAttachmentByHandle,
    removeAttachment,
    deleteItem,
    updateItem,
    findItemByTitle,
    findItemById,
  }
})
