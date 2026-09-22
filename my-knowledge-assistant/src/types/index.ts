// 专门存放 TS 类型定义
import type { Component } from 'vue'

// 复习点 2：使用 interface 定义对象的形状（Shape）
export interface MenuItem {
  path: string
  name: string
  // 图标组件（lucide-vue-next 导出的图标），配 <component :is="icon" /> 渲染。
  // 原来是脚手架留下的 icon?: string 占位，从没被用过，这里换成真正能渲染的类型
  icon?: Component
  tour?: string // 新手引导用：对应引导步骤的 data-tour 选择器
}

//新增数据库条目类型(升级为树形结构)
export interface KnowledgeItem {
  id?: number // 自增主键，可选（新增时没有 id）
  title: string // 技能名称
  description: string // 短描述（一句话摘要，列表 / 头部展示）
  notes?: string // 长笔记（详情页「文本」标签页的详细内容，可选）
  level: '已学会' | '学习中' | '待学习' // 掌握程度（联合类型）
  createdAt: string // 创建时间
  updatedAt: string
  children: KnowledgeItem[] // 子技能列表（树形结构递归类型）
  attachments: Attachment[] // 附件列表（支持图片预览）
  mindmapData?: MindMapNode | null // 新增：思维导图数据，可选
  // chats: 关系第一版（手动关联，只存目标 id，无 AI 推断）
  prerequisites?: number[] // 前置知识：其他 KnowledgeItem 的 id
  relatedKnowledge?: number[] // 相关知识：其他 KnowledgeItem 的 id
  relatedMaterials?: string[] // 相关资料：自由文本 / 链接（v1 不强制关联附件）
  relatedProjects?: string[] // 相关项目：Project 的 id（注意 Project.id 是 string）
}

//新增思维导图节点类型
export interface MindMapNode {
  data: {
    text: string
  }
  children?: MindMapNode[]
}

// 项目节点（任务/里程碑）
export interface ProjectNode {
  id: string // 节点唯一标识
  title: string // 节点标题
  description?: string // 节点描述，可选
  progress: number // 节点进度，0-100
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  files: string[] // 相关文件列表
  attachments: Attachment[] // 新增：附件列表（支持图片预览）
  children: ProjectNode[] // 新增：子节点
  createdAt: string // 创建时间
  updatedAt: string // 更新时间
}

//新增:附件类型
export interface Attachment {
  id: string // 附件唯一标识
  name: string // 附件名称
  type: string // 附件类型（如 'image/png', 'application/pdf' 等）
  // local-first 闭环：优先用文件句柄（FSAA），只存句柄不存文件内容；
  // 浏览器不支持 showOpenFilePicker（如 Firefox）时降级为 Base64（data 有值、handle 为 null）
  handle?: FileSystemFileHandle | null // 文件句柄（Chrome/Edge 可序列化进 IndexedDB，重开时授权后重读）
  data?: string // 附件数据（Base64 编码，降级方案使用，可选）
  size?: number // 附件大小（字节数，可选）
  dateAdded: string // 添加时间
}

//项目
export interface Project {
  id: string // 项目唯一标识
  name: string // 项目名称
  description?: string // 项目描述，可选
  deadline?: string // 项目截止日期，可选
  nodes: ProjectNode[] // 项目节点列表
  createdAt: string // 创建时间
  updatedAt: string // 更新时间
}
