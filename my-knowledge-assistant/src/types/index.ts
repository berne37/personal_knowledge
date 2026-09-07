// 专门存放 TS 类型定义
// ✨ 复习点 2：使用 interface 定义对象的形状（Shape）
export interface MenuItem {
    path: string;
    name: string;
    icon?: string;// 属性后面加 ? 表示可选属性
}

//新增数据库条目类型(升级为树形结构)
export interface KnowledgeItem {
     id?: number;          // 自增主键，可选（新增时没有 id）
    title: string;        // 技能名称
    description: string;  // 描述
    level: '已学会' | '学习中' | '待学习';  // 掌握程度（联合类型）
    createdAt: string;    // 创建时间
    updatedAt: string
    children:KnowledgeItem[]; // 子技能列表（树形结构递归类型）
    attachments: Attachment[]; // 附件列表（支持图片预览）
    mindmapData?: MindMapNode | null; // 新增：思维导图数据，可选
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
    id: string; // 节点唯一标识
    title: string; // 节点标题
    description?: string; // 节点描述，可选
    progress:number; // 节点进度，0-100
     status: 'pending' | 'in-progress' | 'completed' | 'blocked'
    files: string[]; // 相关文件列表
    attachments: Attachment[]          // 新增：附件列表（支持图片预览）
     children: ProjectNode[]   // 新增：子节点
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
}

//新增:附件类型
export interface Attachment {
    id: string; // 附件唯一标识
    name: string; // 附件名称
    type: string; // 附件类型（如 'image/png', 'application/pdf' 等）
    data: string; // 附件数据（Base64 编码）
    size?: number; // 附件大小（字节数，可选）
    dateAdded: string; // 添加时间
}

//项目
export interface Project {
    id: string; // 项目唯一标识
    name: string; // 项目名称
    description?: string; // 项目描述，可选
    deadline?: string; // 项目截止日期，可选
    nodes: ProjectNode[]; // 项目节点列表
    createdAt: string; // 创建时间
    updatedAt: string; // 更新时间
}