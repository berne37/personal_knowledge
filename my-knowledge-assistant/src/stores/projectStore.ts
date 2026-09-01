import {defineStore} from 'pinia'
import {ref} from 'vue'
import {openDB} from 'idb'
import type {Project,ProjectNode} from '@/types'
import type { Attachment } from '@/types'

//初始化INdexedDB数据库
const dbPromise = openDB('ProjectDB', 1, {
    upgrade(db) {
        if (!db.objectStoreNames.contains('projects')) {    // 创建一个名为 'projects' 的对象存储
            const store = db.createObjectStore('projects', {keyPath: 'id'})// 指定 'id' 作为主键
            store.createIndex('name', 'name')// 创建一个索引，允许按 'name' 查询
        }
    }
})

export const useProjectStore = defineStore('project', () => {
    const projects = ref<Project[]>([])// 存储所有项目的响应式数组

    //加载所有项目
    async function loadProjects() {
        const db = await dbPromise
        projects.value = await db.getAll('projects')// 从数据库中获取所有项目
        projects.value.sort((a, b) => (a.updatedAt < b.updatedAt) ? 1 : -1)// 按更新时间降序排序
    }
    //获取单个项目
    async function getProject(id: string): Promise<Project | undefined> {
        const db = await dbPromise
        return await db.get('projects', id)// 根据项目ID从数据库中获取项目
    }

    //创建项目
    async function createProject(project: Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'nodes'>) {
        const newProject: Project = {
            ...project,
            id: crypto.randomUUID()?crypto.randomUUID() : Date.now().toString(), // 使用随机UUID作为项目ID
            nodes: [], // 初始化项目节点为空数组
            createdAt: new Date().toISOString(), // 设置创建时间为当前时间
            updatedAt: new Date().toISOString()  // 设置更新时间为当前时间
        }
        const db = await dbPromise
        await db.add('projects', newProject)// 将新项目添加到数据库中
        await loadProjects()// 重新加载所有项目
        return newProject// 返回新创建的项目
    }

     // 更新项目基本信息
     async function updateProject(id: string,data: Partial<Project>) {
        const db = await dbPromise
        const project = await db.get('projects', id)// 根据项目ID从数据库中获取项目
        if (!project) return// 如果项目不存在，直接返回
        const update = {
            ...project,
            ...data,
            updatedAt: new Date().toISOString() // 更新更新时间为当前时间
        }
        await db.put('projects', update)// 将更新后的项目保存到数据库中
        await loadProjects()// 重新加载所有项目
    }

    //删除项目
    async function deleteProject(id: string) {
        const db = await dbPromise
        await db.delete('projects', id)// 根据项目ID从数据库中删除项目
        await loadProjects()// 重新加载所有项目
    }

    // 添加节点
    async function addNode(projectId: string, node: Omit<ProjectNode, 'id' | 'createdAt' | 'updatedAt'>) {
    const db = await dbPromise
    const project = await db.get('projects', projectId)
    if (!project) return

    const newNode: ProjectNode = {
        ...node,
        id: crypto.randomUUID()?crypto.randomUUID() : Date.now().toString(), // 使用随机UUID作为节点ID
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        attachments: [] // 初始化附件为空数组
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
  node: Omit<ProjectNode, 'id' | 'createdAt' | 'updatedAt' | 'children' | 'attachments'>
) {
  const db = await dbPromise
  const project = await db.get('projects', projectId)
  if (!project) return

  // 递归查找父节点
  function findParent(nodes: ProjectNode[]): ProjectNode | null {
    for (const n of nodes) {
      if (n.id === parentNodeId) return n
      if (n.children?.length) {
        const found = findParent(n.children)
        if (found) return found
      }
    }
    return null
  }

  const parent = findParent(project.nodes)
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
    attachments: []
  }

  if (!parent.children) parent.children = []
  parent.children.push(newNode)
  parent.updatedAt = new Date().toISOString()
  project.updatedAt = new Date().toISOString()

  await db.put('projects', project)
  await loadProjects()
}

    // 添加附件（支持图片预览）
    async function addAttachment(projectId: string, nodeId:string, file: File) {
        const db = await dbPromise
        const project = await db.get('projects', projectId)
        if (!project) return

        const node = project.nodes.find((n: ProjectNode) => n.id === nodeId)
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
            dateAdded: new Date().toISOString()
        }

        if(!node.attachments) node.attachments = [] // 初始化附件数组
        node.attachments.push(attachment)
        node.updatedAt = new Date().toISOString() // 更新节点的更新时间
        project.updatedAt = new Date().toISOString() // 更新项目的更新时间
        await db.put('projects', project)
        await loadProjects()
    }

    //删除附件
    async function removeAttachment(projectId: string, nodeId:string, attachmentId: string) {
        const db = await dbPromise
        const project = await db.get('projects', projectId)
        if (!project) return

        const node = project.nodes.find((n: ProjectNode) => n.id === nodeId)
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

        const index = project.nodes.findIndex((n: ProjectNode) => n.id === nodeId)
        if (index === -1) return
        project.nodes[index] = {
            ...project.nodes[index],
            ...data,
            updatedAt: new Date().toISOString() // 更新节点的更新时间
        }
        project.updatedAt = new Date().toISOString() // 更新项目的更新时间
        await db.put('projects', project)
        await loadProjects()

    }

    // 删除节点
    async function deleteNode(projectId: string, nodeId: string) {
        const db = await dbPromise
        const project = await db.get('projects', projectId)
        if (!project) return

        project.nodes = project.nodes.filter((n: ProjectNode) => n.id !== nodeId)
        project.updatedAt = new Date().toISOString() // 更新项目的更新时间
        await db.put('projects', project)
        await loadProjects()
    }


    // 添加文件到节点
    async function addFileToNode(projectId: string, nodeId: string, filePath: string) {
        const db = await dbPromise
        const project = await db.get('projects', projectId)
        if (!project) return

        const node = project.nodes.find((n: ProjectNode) => n.id === nodeId)
        if (!node) return

        if(!node.file) node.files = [] // 初始化文件数组
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

        const node = project.nodes.find((n: ProjectNode) => n.id === nodeId)
        if (!node) return

        node.files = node.files.filter((f: string) => f !== filePath)
        node.updatedAt = new Date().toISOString() // 更新节点的更新时间
        project.updatedAt = new Date().toISOString() // 更新项目的更新时间
        await db.put('projects', project)
        await loadProjects()
    }

    // 计算项目总进度（节点平均进度）
    function getProjectProgress(project: Project): number {
        if (project.nodes.length === 0) return 0    // 如果没有节点，进度为0
        const total = project.nodes.reduce((sum: number, n: ProjectNode) => sum + n.progress, 0)// 计算所有节点的进度总和
        return Math.round(total / project.nodes.length)// 计算平均进度并四舍五入
    }

    // 计算项目完成节点数
    function getCompletedNodes(project: Project): number {
        return project.nodes.filter(n => n.progress === 100).length// 计算完成节点的数量
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
    removeAttachment
  }
})