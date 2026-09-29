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

      // 老数据的子条目没有 id，递归补一个并写回数据库
      let changed = false
      function fillId(nodes: KnowledgeItem[]) {
        for (const node of nodes) {
          if (node.id == null) {
            node.id = Date.now() + Math.floor(Math.random() * 1000)
            changed = true
          }
          if (node.children?.length) fillId(node.children)
        }
      }
      for (const item of allItems) fillId(item.children || [])
      // chats: put 的是 plain 的 allItems（含 FileSystemFileHandle 等可被结构化克隆的原生对象），不再过 reactive
      if (changed) {
        for (const root of allItems) await db.put('items', root)
      }

      items.value = allItems
      items.value.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    })().finally(() => {
      // 加载结束后清空缓存，下次刷新/重新打开仍能重新读取
      loadItemsPromise = null
    })
    return loadItemsPromise
  }

  // 添加根条目
  async function addItem(
    item: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'children' | 'attachments'>,
  ) {
    const db = await dbPromise
    const newItem: KnowledgeItem = {
      ...item,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
      attachments: [],
    }
    await db.add('items', newItem)
    await loadItems()
  }

  // 添加子条目
  async function addChildItem(
    parentId: number,
    childData: Omit<KnowledgeItem, 'id' | 'createdAt' | 'updatedAt' | 'children' | 'attachments'>,
  ) {
    const db = await dbPromise
    const parent = await db.get('items', parentId)
    if (!parent) return

    const newChild: KnowledgeItem = {
      id: Date.now() + Math.floor(Math.random() * 1000), // 子条目也要有唯一 id
      ...childData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
      attachments: [],
    }

    if (!parent.children) parent.children = []
    parent.children.push(newChild)
    parent.updatedAt = new Date().toISOString()

    await db.put('items', parent)
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
    function search(nodes: KnowledgeItem[]): KnowledgeItem | null {
      for (const node of nodes) {
        if (node.title === title) return node
        if (node.children?.length) {
          const found = search(node.children)
          if (found) return found
        }
      }
      return null
    }
    return search(items.value)
  }

  // 按 id 查找条目（含子条目）。路由改用 :id 后靠它取数据。
  //    标题可以重复，id 不会，所以按 id 找才不会跳错条目。
  function findItemById(id: number): KnowledgeItem | null {
    function search(nodes: KnowledgeItem[]): KnowledgeItem | null {
      for (const node of nodes) {
        if (node.id === id) return node
        if (node.children?.length) {
          const found = search(node.children)
          if (found) return found
        }
      }
      return null
    }
    return search(items.value)
  }

  // 找出某个条目的父条目；顶层条目返回 null（写法参考 projectStore.ts:98 的 findParent）
  //    递归时把「上一层节点」当作 parent 一路传下去，命中目标就返回它。
  function findParentOfId(id: number): KnowledgeItem | null {
    function search(nodes: KnowledgeItem[], parent: KnowledgeItem | null): KnowledgeItem | null {
      for (const node of nodes) {
        if (node.id === id) return parent
        if (node.children?.length) {
          const found = search(node.children, node)
          if (found) return found
        }
      }
      return null
    }
    return search(items.value, null)
  }

  // 递归删除条目（含子条目）
  async function deleteItem(id: number) {
    if (id == null) return // 防止删错条目
    const db = await dbPromise

    // 先检查是否是根条目
    const root = await db.get('items', id)
    if (root) {
      await db.delete('items', id)
      await loadItems()
      return
    }

    // 在所有根条目中递归查找并删除子条目
    const allItems = await db.getAll('items')

    function findAndDelete(nodes: KnowledgeItem[]): boolean {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]! // 非空断言（索引保证存在）
        if (node.id === id) {
          nodes.splice(i, 1)
          return true
        }
        if (node.children?.length) {
          if (findAndDelete(node.children)) return true
        }
      }
      return false
    }

    for (const item of allItems) {
      if (findAndDelete([item])) {
        await db.put('items', item)
        await loadItems()
        return
      }
    }
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

    // 先检查是否是根条目
    const root = await db.get('items', id)
    if (root) {
      const updated: KnowledgeItem = {
        ...root,
        ...plainData,
        updatedAt: new Date().toISOString(),
      }
      await db.put('items', updated)
      await loadItems()
      return
    }

    // 在所有根条目中递归查找并更新子条目
    const allItems = await db.getAll('items')

    function findAndUpdate(nodes: KnowledgeItem[]): boolean {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]!
        if (node.id === id) {
          const updatedNode: KnowledgeItem = {
            ...node,
            ...plainData,
            updatedAt: new Date().toISOString(),
          }
          nodes[i] = updatedNode
          return true
        }
        if (node.children?.length) {
          if (findAndUpdate(node.children)) return true
        }
      }
      return false
    }

    for (const item of allItems) {
      if (findAndUpdate([item])) {
        await db.put('items', item)
        await loadItems()
        return
      }
    }
  }

  // 计算子条目总数（含递归）
  function countChildren(item: KnowledgeItem): number {
    let count = item.children?.length || 0
    for (const child of item.children || []) {
      count += countChildren(child)
    }
    return count
  }

  loadItems()

  return {
    items,
    loadItems,
    addItem,
    addChildItem,
    addAttachment,
    addAttachmentByHandle,
    removeAttachment,
    deleteItem,
    updateItem,
    countChildren,
    findItemByTitle,
    findItemById,
    findParentOfId,
  }
})
