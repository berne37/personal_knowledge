import { defineStore } from 'pinia'
import { ref } from 'vue'
import { openDB } from 'idb'
import type { Project, ProjectNode } from '@/types'
import type { Attachment } from '@/types'

//初始化INdexedDB数据库
const dbPromise = openDB('ProjectDB', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('projects')) {
      // 创建一个名为 'projects' 的对象存储
      const store = db.createObjectStore('projects', { keyPath: 'id' }) // 指定 'id' 作为主键
      store.createIndex('name', 'name') // 创建一个索引，允许按 'name' 查询
    }
  },
})

export const useProjectStore = defineStore('project', () => {
  const projects = ref<Project[]>([]) // 存储所有项目的响应式数组

  // 🔧 修复：原来 updateNode / deleteNode / 附件、文件操作都只用顶层 find，
  // 子节点的这些操作拿不到节点就静默 return——点了没反应、不报错。
  // 统一提供递归查找；addChildNode 原来在函数内部也嵌了一份同样的 findParent，一并收编。
  function findNode(nodes: ProjectNode[], nodeId: string): ProjectNode | null {
    for (const n of nodes) {
      if (n.id === nodeId) return n
      if (n.children?.length) {
        const found = findNode(n.children, nodeId)
        if (found) return found
      }
    }
    return null
  }

  // 🔧 修复：deleteNode 原来只 filter 顶层数组，子树里的节点删不掉。
  // 递归删除：先看本层，再看各子树，删到了返回 true（调用方据此决定要不要落库）。
  function removeNode(nodes: ProjectNode[], nodeId: string): boolean {
    const index = nodes.findIndex((n) => n.id === nodeId)
    if (index !== -1) {
      nodes.splice(index, 1)
      return true
    }
    return nodes.some((n) => n.children?.length && removeNode(n.children, nodeId))
  }

  //加载所有项目
  async function loadProjects() {
    const db = await dbPromise
    projects.value = await db.getAll('projects') // 从数据库中获取所有项目
    projects.value.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)) // 按更新时间降序排序
  }
  //获取单个项目
  async function getProject(id: string): Promise<Project | undefined> {
    const db = await dbPromise
    return await db.get('projects', id) // 根据项目ID从数据库中获取项目
  }

  //创建项目
  async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'nodes'>) {
    const newProject: Project = {
      ...project,
      id: crypto.randomUUID() ? crypto.randomUUID() : Date.now().toString(), // 使用随机UUID作为项目ID
      nodes: [], // 初始化项目节点为空数组
      createdAt: new Date().toISOString(), // 设置创建时间为当前时间
      updatedAt: new Date().toISOString(), // 设置更新时间为当前时间
    }
    const db = await dbPromise
    await db.add('projects', newProject) // 将新项目添加到数据库中
    await loadProjects() // 重新加载所有项目
    return newProject // 返回新创建的项目
  }

  // 更新项目基本信息
  async function updateProject(id: string, data: Partial<Project>) {
    const db = await dbPromise
    const project = await db.get('projects', id) // 根据项目ID从数据库中获取项目
    if (!project) return // 如果项目不存在，直接返回
    const update = {
      ...project,
      ...data,
      updatedAt: new Date().toISOString(), // 更新更新时间为当前时间
    }
    await db.put('projects', update) // 将更新后的项目保存到数据库中
    await loadProjects() // 重新加载所有项目
  }

  //删除项目
  async function deleteProject(id: string) {
    const db = await dbPromise
    await db.delete('projects', id) // 根据项目ID从数据库中删除项目
    await loadProjects() // 重新加载所有项目
  }

  // 添加节点
  async function addNode(
    projectId: string,
    node: Omit<ProjectNode, 'id' | 'createdAt' | 'updatedAt'>,
  ) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const newNode: ProjectNode = {
      ...node,
      id: crypto.randomUUID() ? crypto.randomUUID() : Date.now().toString(), // 使用随机UUID作为节点ID
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      attachments: [], // 初始化附件为空数组
    }
    project.nodes.push(newNode)
    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 添加子节点（指定母节点 ID）
  async function addChildNode(
    projectId: string,
    parentNodeId: string,
    node: Omit<ProjectNode, 'id' | 'createdAt' | 'updatedAt' | 'children' | 'attachments'>,
  ) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const parent = findNode(project.nodes, parentNodeId)
    if (!parent) {
      console.error('找不到父节点')
      return
    }

    const newNode: ProjectNode = {
      ...node,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      children: [],
      attachments: [],
    }

    if (!parent.children) parent.children = []
    parent.children.push(newNode)
    parent.updatedAt = new Date().toISOString()
    project.updatedAt = new Date().toISOString()

    await db.put('projects', project)
    await loadProjects()
  }

  // 添加附件（支持图片预览）
  async function addAttachment(projectId: string, nodeId: string, file: File) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const node = findNode(project.nodes, nodeId)
    if (!node) return

    //读取文件为base64
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const attachment = {
      id: crypto.randomUUID(),
      name: file.name,
      type: file.type,
      data: dataUrl,
      size: file.size,
      dateAdded: new Date().toISOString(),
    }

    if (!node.attachments) node.attachments = [] // 初始化附件数组
    node.attachments.push(attachment)
    node.updatedAt = new Date().toISOString() // 更新节点的更新时间
    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  //删除附件
  async function removeAttachment(projectId: string, nodeId: string, attachmentId: string) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const node = findNode(project.nodes, nodeId)
    if (!node) return

    node.attachments = node.attachments.filter((a: Attachment) => a.id !== attachmentId)
    node.updatedAt = new Date().toISOString() // 更新节点的更新时间
    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 更新节点
  async function updateNode(projectId: string, nodeId: string, data: Partial<ProjectNode>) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    // 🔧 修复：原来只扫顶层数组并按下标替换，子节点的更新静默失效。
    // 递归拿到节点后原地合并——对象来自 db.get，是普通对象，直接改不影响响应式。
    const node = findNode(project.nodes, nodeId)
    if (!node) return
    Object.assign(node, data, { updatedAt: new Date().toISOString() })

    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 删除节点
  async function deleteNode(projectId: string, nodeId: string) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    // 🔧 修复：原来只 filter 顶层数组，子树里的节点删不掉。
    // 没删到任何节点就不落库，避免白白刷新 updatedAt。
    if (!removeNode(project.nodes, nodeId)) return

    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 添加文件到节点
  async function addFileToNode(projectId: string, nodeId: string, filePath: string) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const node = findNode(project.nodes, nodeId)
    if (!node) return

    // 🔧 修复：原来写的是 if(!node.file)，类型里只有 files 没有 file——
    // 条件恒为 true，每加一个文件就先把数组清空，上一个文件被静默丢掉。
    if (!node.files) node.files = [] // 初始化文件数组
    node.files.push(filePath)
    node.updatedAt = new Date().toISOString() // 更新节点的更新时间
    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 删除文件
  async function removeFileFromNode(projectId: string, nodeId: string, filePath: string) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const node = findNode(project.nodes, nodeId)
    if (!node) return

    // 防御：files 还没初始化过时没有可删的东西，直接返回，别让 filter 抛错
    if (!node.files) return

    node.files = node.files.filter((f: string) => f !== filePath)
    node.updatedAt = new Date().toISOString() // 更新节点的更新时间
    project.updatedAt = new Date().toISOString() // 更新项目的更新时间
    await db.put('projects', project)
    await loadProjects()
  }

  // 计算项目总进度（节点平均进度）
  function getProjectProgress(project: Project): number {
    if (project.nodes.length === 0) return 0 // 如果没有节点，进度为0
    const total = project.nodes.reduce((sum: number, n: ProjectNode) => sum + n.progress, 0) // 计算所有节点的进度总和
    return Math.round(total / project.nodes.length) // 计算平均进度并四舍五入
  }

  // 计算项目完成节点数
  function getCompletedNodes(project: Project): number {
    return project.nodes.filter((n) => n.progress === 100).length // 计算完成节点的数量
  }

  return {
    projects,
    loadProjects,
    getProject,
    createProject,
    updateProject,
    deleteProject,
    addNode,
    addChildNode,
    updateNode,
    deleteNode,
    addFileToNode,
    removeFileFromNode,
    getProjectProgress,
    getCompletedNodes,
    addAttachment,
    removeAttachment,
  }
})
