import { createRouter, createWebHistory } from 'vue-router'
// ✨ 复习点 6：TS 的 import type 只导入类型，不导入值，用于代码优化
import type {RouteRecordRaw} from 'vue-router'

// 导入刚才创建的页面组件
import KnowledgeView from '@/views/KnowledgeView.vue';
import ChatView from '@/views/ChatView.vue';
import MindmapView from '@/views/MindmapView.vue';
import ProjectView from '@/views/ProjectView.vue';

// 定义路由配置，显式声明类型为 RouteRecordRaw[]
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Knowledge', component: KnowledgeView },
  { path: '/chat', name: 'Chat', component: ChatView },
  { path: '/mindmap', name: 'Mindmap', component: MindmapView },
  { path: '/projects', name: 'Project', component: ProjectView }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes, // 这里 routes 自动匹配上方定义
});

export default router;
