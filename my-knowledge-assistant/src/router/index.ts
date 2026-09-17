import { createRouter, createWebHistory } from 'vue-router'
// ✨ 复习点 6：TS 的 import type 只导入类型，不导入值，用于代码优化
import type {RouteRecordRaw} from 'vue-router'
import ProjectsView from '../views/ProjectView.vue'
import SettingsView from '@/views/SettingsView.vue'

// 导入刚才创建的页面组件
import KnowledgeView from '@/views/KnowledgeView.vue';
import ChatView from '@/views/ChatView.vue';
import MindmapView from '@/views/MindmapView.vue';
import ProjectView from '@/views/ProjectView.vue';
import PDFView from '@/views/PDFView.vue'
// 定义路由配置，显式声明类型为 RouteRecordRaw[]
const routes: RouteRecordRaw[] = [
  { path: '/', name: 'Knowledge', component: KnowledgeView },
  // 🔧 路由参数从 title 改成 id：标题可能重复（同名条目会跳错），id 唯一。
  //    注意：params 里必须是字符串，传的时候要 String(id)，取的时候要 Number(...) 转回来。
  { path: '/knowledge/:id', name: 'KnowledgeDetail', component: () => import('@/views/KnowledgeDetailView.vue') },
  { path: '/chat', name: 'Chat', component: ChatView },
  { path: '/mindmap', name: 'Mindmap', component: MindmapView },
  { path: '/pdf', name: 'PDF', component: PDFView },
  { path: '/projects', name: 'Projects', component: ProjectsView },
  { path: '/settings', name: 'Settings', component: SettingsView }
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes, // 这里 routes 自动匹配上方定义
});

export default router;