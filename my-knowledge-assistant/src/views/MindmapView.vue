<template>
  <div class="mindmap-view">
    <div class="header">
      <h2>思维导图</h2>
      <div class="actions">
        <!-- 使用 store 中的 isLoading -->
        <button @click="generateFromKnowledge" :disabled="store.isLoading">
          {{ store.isLoading ? '生成中...' : '从知识库生成' }}
        </button>
        <button @click="handleLocalGenerate" :disabled="store.isLoading">
          加载示例数据（测试）
        </button>
      </div>
    </div>
    
    <!-- 使用 store 中的 errorMessage -->
    <div v-if="store.errorMessage" class="error">
      ❌ {{ store.errorMessage }}
    </div>

    <!-- 使用 store 中的 mindMapData 和 isLoading -->
    <div v-if="!store.mindMapData && !store.isLoading" class="placeholder">
      <p>点击「从知识库生成」或「加载示例数据」来展示思维导图</p>
    </div>

    <div v-if="store.isLoading" class="loading">
      <p>AI 正在生成思维导图...</p>
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>

    <!-- 使用 store 中的 mindMapData -->
    <MindMap v-if="store.mindMapData" :data="store.mindMapData" />
  </div>
</template>

<script setup lang="ts">
// 使用 store
import { useMindmapStore } from '@/stores/mindmapStrore'
import { generateMindMapWithAI } from '@/services/mindMap'
import MindMap from '@/components/MindMap.vue'

const store = useMindmapStore()

// 使用 store 中的方法
function handleLocalGenerate() {
  store.generateLocal()
}

// AI 生成（使用 store 管理状态）
async function generateFromKnowledge() {
  store.setError('')
  store.setLoading(true)
  store.setData(null)

  try {
    await generateMindMapWithAI(
      undefined,
      (data) => {
        store.setData(data)
        store.setLoading(false)
      },
      (error) => {
        store.setError(error.message)
        store.setLoading(false)
      }
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
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding: 0 var(--spacing-xs);
}
.header h2 { margin: 0; }
.actions {
  display: flex;
  gap: var(--spacing-sm);
}
.actions button {
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
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
.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}
</style>