<script setup lang="ts">
import type { MenuItem } from '@/types'
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const menuList = ref<MenuItem[]>([
  { path: '/', name: '知识库' },
  { path: '/chat', name: 'AI对话' },
  { path: '/mindmap', name: '思维导图' },
  { path: '/pdf', name: 'PDF阅读' },
  { path: '/projects', name: '项目进度' },
  { path: '/settings', name: '设置' },
])
</script>

<template>
  <div class="app-shell">
    <nav class="sidebar">
      <ul>
        <li v-for="item in menuList" :key="item.path">
          <RouterLink :to="item.path" class="nav-link">
            {{ item.name }}
          </RouterLink>
        </li>
      </ul>
    </nav>

    <main class="content">
      <RouterView />
    </main>
  </div>
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
  text-decoration: none;
  color: inherit;
}

/* 🔧 修复：侧边栏原先没有任何选中态，用户看不出自己当前在哪个页面。
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
</style>
