<script setup lang="ts">
import type { MenuItem } from '@/types'
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'
import { FileText, FolderKanban, Library, MessageSquare, Network, Settings } from 'lucide-vue-next'
import OnboardingGuide from '@/components/OnboardingGuide.vue'
import { useRoute } from 'vue-router'
const route = useRoute()

// chats: 历史侧栏的开关在侧边栏「AI对话」按钮上——点它既进入对话页，又展开/收起历史列表
import { useChatStore } from '@/stores/chatStore'
const chatStore = useChatStore()

function onMenuClick(item: MenuItem) {
  if (item.path === '/chat') chatStore.toggleHistory()
}

// 菜单是静态数据，永远不会变，所以用普通常量而不是 ref。
// 另外 ref 会把数组元素深包装成 reactive proxy，图标组件对象被包住后渲染多绕一层，没必要。
const menuList: MenuItem[] = [
  { path: '/', name: '知识库', icon: Library, tour: 'knowledge' },
  { path: '/chat', name: 'AI对话', icon: MessageSquare, tour: 'chat' },
  { path: '/mindmap', name: '思维导图', icon: Network, tour: 'mindmap' },
  { path: '/pdf', name: 'PDF阅读', icon: FileText, tour: 'pdf' },
  { path: '/projects', name: '项目进度', icon: FolderKanban, tour: 'projects' },
  { path: '/settings', name: '设置', icon: Settings, tour: 'settings' },
]

// 引导组件实例：侧边栏「新手引导」按钮通过它重新打开引导
const onboardingRef = ref<InstanceType<typeof OnboardingGuide> | null>(null)
</script>

<template>
  <div class="app-shell">
    <nav class="sidebar">
      <ul>
        <li v-for="item in menuList" :key="item.path" :data-tour="item.tour">
          <RouterLink :to="item.path" class="nav-link" @click="onMenuClick(item)">
            <!-- chats: 图标是 SVG 组件，颜色继承 currentColor，所以选中态变蓝时图标会跟着变 -->
            <component :is="item.icon" :size="18" :stroke-width="1.8" />
            <span>{{ item.name }}</span>
          </RouterLink>
        </li>
      </ul>

      <!-- 侧边栏底部：随时重看新手引导 -->
      <div class="sidebar-footer">
        <button class="guide-btn" @click="onboardingRef?.openWelcome()">新手引导</button>
      </div>
    </nav>

    <main class="content" :class="{ 'content--flush': route.path === '/chat' }">
      <RouterView />
    </main>
  </div>

  <!-- 新手引导：欢迎卡 + 聚光灯 tour（自包含，靠 localStorage 记住是否看过） -->
  <OnboardingGuide ref="onboardingRef" />
</template>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 200px;
  background: var(--color-bg-hover);
  border-right: 1px solid var(--color-bg-border);
  padding: var(--spacing-lg);
  /* 改成纵向 flex，让底部的「新手引导」按钮能靠最下 */
  display: flex;
  flex-direction: column;
}

/* 侧边栏底部入口：重看新手引导 */
.sidebar-footer {
  margin-top: auto;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-bg-border);
}
.guide-btn {
  width: 100%;
  border: 1px solid var(--color-primary);
  background: transparent;
  color: var(--color-primary-dark);
  padding: 8px 0;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.guide-btn:hover {
  background: var(--color-primary-light);
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 12px var(--spacing-md);
  margin: var(--spacing-xs) 0;
  border-radius: var(--radius-md);
  transition: background var(--transition-normal);
}

li:hover {
  background: var(--color-bg-border);
}

.nav-link {
  /* chats: 图标 + 文字排成一行、垂直居中；gap 用的是设计 tokens，跟全局间距体系保持一致 */
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: inherit;
}

/* 空间不足时不让图标被压扁变形 */
.nav-link svg {
  flex-shrink: 0;
}

/* 修复：侧边栏原先没有任何选中态，用户看不出自己当前在哪个页面。
   Vue Router 会自动给「精确匹配当前路由」的 RouterLink 加上 .router-link-exact-active 类，
   我们只要写样式就行，不需要自己维护 activeIndex 之类的状态。

   为什么用 exact-active 而不是 active：
   - router-link-active 是「前缀匹配」，指向 '/' 的链接在任何子路径下都会被点亮
   - router-link-exact-active 是「精确匹配」，/ 和 /chat 这种平级路由用它才准确 */
.nav-link.router-link-exact-active {
  color: var(--color-primary);
  font-weight: 500;
}

/* 让整个 li 高亮，而不只是文字变色，视觉上更像「当前页签」 */
li:has(.router-link-exact-active) {
  background: var(--color-primary-light);
}

.content {
  flex: 1;
  min-width: 0;
  padding: var(--spacing-xl);
}
.content--flush {
  padding: 0; /* 聊天页自己管理内边距：标题栏和输入条要顶格贴边，不能带着内容区的灰边悬浮 */
}
</style>
