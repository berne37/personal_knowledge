<script setup lang="ts">
import type { MenuItem } from '@/types'
import { ref } from 'vue'
import { RouterLink, RouterView } from 'vue-router'

const menuList = ref<MenuItem[]>([
  { path: '/', name: '知识库' },
  { path: '/chat', name: 'AI对话' },
  { path: '/mindmap', name: '思维导图' },
  { path: '/projects', name: '项目进度' }
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
  background: #f5f7fa;
  padding: 20px;
}

ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  padding: 12px 16px;
  margin: 4px 0;
  border-radius: 8px;
  transition: background 0.2s;
}

li:hover {
  background: #e8ecf1;
}

.nav-link {
  text-decoration: none;
  color: inherit;
}

.content {
  flex: 1;
  padding: 30px;
}
</style>
