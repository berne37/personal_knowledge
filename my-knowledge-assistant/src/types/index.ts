// 专门存放 TS 类型定义
// ✨ 复习点 2：使用 interface 定义对象的形状（Shape）
export interface MenuItem {
    path: string;
    name: string;
    icon?: string;// 属性后面加 ? 表示可选属性
}

//新增数据库条目类型
export interface KnowledgeItem {
     id?: number;          // 自增主键，可选（新增时没有 id）
    title: string;        // 技能名称
    description: string;  // 描述
    level: '已学会' | '学习中' | '待学习';  // 掌握程度（联合类型）
    createdAt: string;    // 创建时间
}