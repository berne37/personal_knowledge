<template>
  <div class="mindmap-view">
    <div class="header">
      <h2>思维导图</h2>
      <div class="actions">
        <!-- 使用 store 中的 isLoading -->
        <button @click="generateFromKnowledge" :disabled="store.isLoading">
          {{ store.isLoading ? '生成中...' : '从知识库生成' }}
        </button>
      </div>
    </div>

    <!-- 使用 store 中的 errorMessage -->
    <div v-if="store.errorMessage" class="error">
      {{ store.errorMessage }}
    </div>

    <!-- 使用 store 中的 mindMapData 和 isLoading -->
    <div v-if="!store.mindMapData && !store.isLoading" class="placeholder">
      <p>点击「从知识库生成」来展示思维导图</p>
    </div>

    <div v-if="store.isLoading" class="loading">
      <p>AI 正在生成思维导图...</p>
      <div class="typing-dots"><span></span><span></span><span></span></div>
    </div>

    <!-- 使用 store 中的 mindMapData -->
    <MindMap v-if="store.mindMapData" :data="store.mindMapData" />
  </div>
</template>

<script setup lang="ts">
// 使用 store
import { useMindmapStore } from '@/stores/mindmapStore'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { generateMindMapWithAI } from '@/services/mindMap'
import MindMap from '@/components/MindMap.vue'

const store = useMindmapStore()
const knowledgeStore = useKnowledgeStore()

// AI 生成（使用 store 管理状态）
async function generateFromKnowledge() {
  store.setError('')
  store.setLoading(true)
  store.setData(null)

  try {
    // 「空知识库」的检查挪到这里了。
    // 以前是 generateMindMapWithAI 自己读 store 判断的，现在它只认传进来的数据，
    // 这个「全库视角」的判断就该由全库页面自己负责。
    if (knowledgeStore.items.length === 0) {
      store.setError('知识库为空，请先添加技能或资料')
      store.setLoading(false)
      return
    }

    // 全库视图没有天然的「根条目」，所以造一个虚拟根节点把全部条目包起来。
    // chats: 子条目下线后，MindMapSource 的多层级字段改叫 items（仅全库导图用），
    // 依然不用伪造 id、createdAt 这些跟画图无关的字段。
    const virtualRoot = {
      title: '我的知识库',
      description: '',
      level: '学习中' as const,
      items: knowledgeStore.items,
    }

    await generateMindMapWithAI(
      virtualRoot,
      undefined,
      (data) => {
        store.setData(data)
        store.setLoading(false)
      },
      (error) => {
        store.setError(error.message)
        store.setLoading(false)
      },
    )
  } catch (e) {
    store.setError((e as Error).message)
    store.setLoading(false)
  }
}
</script>

<style scoped>
.mindmap-view {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  box-sizing: border-box;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding: 0 var(--spacing-xs);
}
.header h2 {
  margin: 0;
}
.actions {
  display: flex;
  gap: var(--spacing-sm);
}
.actions button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  /* 🔧 圆角统一到 --radius-md（8px），与「新建条目」标准一致，原为 4px 方角 */
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: background var(--transition-normal);
}
.actions button:disabled {
  background: var(--color-text-light);
  cursor: not-allowed;
}
.actions button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.error {
  padding: var(--spacing-sm);
  background: var(--color-bg-hover);
  color: var(--color-danger);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-md);
}
.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-md);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  min-height: 300px;
}
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--color-text-secondary);
}
.typing-dots span {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--color-primary);
  border-radius: var(--radius-full);
  margin: 0 var(--spacing-xs);
  animation: typing 1.4s infinite both;
}
.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes typing {
  0%,
  80%,
  100% {
    opacity: 0.3;
    transform: scale(0.8);
  }
  40% {
    opacity: 1;
    transform: scale(1);
  }
}
</style>
