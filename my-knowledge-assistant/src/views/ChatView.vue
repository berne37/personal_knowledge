
<template>
  <div class="chat-container">
    <h2> AI 对话助手</h2>
    
    <div class="message-list" ref="messageListRef">
      <div 
        v-for="(msg, index) in messages" 
        :key="index"
        :class="['message', msg.role]"
      >
        <div class="message-avatar">
          {{ msg.role === 'user' ? '🧑' : '🤖' }}
        </div>
        <div class="message-content">
          {{ msg.content }}
        </div>
      </div>
      <div v-if="isLoading" class="message assistant">
        <div class="message-avatar">🤖</div>
        <div class="message-content typing">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <div class="input-area">
      <input 
        v-model="inputText" 
        placeholder="输入消息并按回车发送..." 
        @keyup.enter="sendMessage"
        :disabled="isLoading"
      />
      <button @click="sendMessage" :disabled="isLoading || !inputText.trim()">
        发送
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { streamChat, type ChatMessage } from '@/services/ai'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<Message[]>([
  { role: 'user', content: '你好，我是用户。' },
  { role: 'assistant', content: '你好，我是 AI 助手，有什么可以帮你的吗？' }
])

const inputText = ref('')
const isLoading = ref(false)
const messageListRef = ref<HTMLElement | null>(null)

import { useKnowledgeStore } from '@/stores/knowledgeStore'
// 在 sendMessage 中，获取知识库数据
const knowledgeStore = useKnowledgeStore()

// 当前的 AI 回复消息（用于增量更新）
let currentAssistantMessage: Message | null = null

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', content: text })
  inputText.value = ''
  scrollToBottom()

  // 创建 AI 回复占位
  currentAssistantMessage = { role: 'assistant', content: '' }
  messages.value.push(currentAssistantMessage)
  isLoading.value = true

   // 构建知识库上下文
  const knowledgeContext = knowledgeStore.items.length > 0
    ? `以下是用户知识库中的内容，请基于这些信息回答问题：\n${knowledgeStore.items.map(item => 
        `- ${item.title}：${item.description}（掌握程度：${item.level}）`
      ).join('\n')}`
    : '用户暂无知识库内容，请用通用知识回答。'

  // 构建完整的消息历史（含系统提示词）
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `你是一个知识助手。${knowledgeContext}\n回答时请保持亲切、专业。`
  }

  // 将系统提示词放在消息历史的最前面
  const history: ChatMessage[] = [
    systemPrompt,
    ...messages.value.map(msg => ({
      role: msg.role,
      content: msg.content
    }))
  ]

  // 调用流式 API
  await streamChat(
    history,
    // onChunk: 增量接收
    (chunk) => {
      if (currentAssistantMessage) {
        currentAssistantMessage.content += chunk
        // 实时滚动
        scrollToBottom()
      }
    },
    // onComplete
    () => {
      isLoading.value = false
      currentAssistantMessage = null
      scrollToBottom()
    },
    // onError
    (error) => {
      console.error('AI 回复失败:', error)
      if (currentAssistantMessage) {
        currentAssistantMessage.content = `❌ 出错了：${error.message}。请检查 API Key 或网络连接。`
      }
      isLoading.value = false
      currentAssistantMessage = null
      scrollToBottom()
    }
  )
}

function scrollToBottom() {
  nextTick(() => {
    if (messageListRef.value) {
      messageListRef.value.scrollTop = messageListRef.value.scrollHeight
    }
  })
}
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  max-width: 800px;
  margin: 0 auto;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-hover);
  margin-bottom: var(--spacing-md);
}

.message {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  animation: fadeIn var(--transition-normal);
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  background: var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.message.user .message-avatar {
  background: var(--color-primary);
}

.message-content {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  background: var(--color-bg-white);
  box-shadow: var(--shadow-sm);
  max-width: 80%;
  line-height: 1.6;
  word-break: break-word;
}

.message.user .message-content {
  background: var(--color-primary);
  color: #fff;
}

.message.assistant .message-content {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
}

/* 打字动画 */
.typing span {
  display: inline-block;
  width: 8px;
  height: 8px;
  background: var(--color-text-placeholder);
  border-radius: var(--radius-full);
  margin: 0 2px;
  animation: typing 1.4s infinite both;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
  40% { opacity: 1; transform: scale(1); }
}

.input-area {
  display: flex;
  gap: var(--spacing-sm);
}
.input-area input {
  flex: 1;
  padding: 12px var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color var(--transition-normal);
}
.input-area input:focus {
  border-color: var(--color-primary);
}
.input-area button {
  padding: 12px 28px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-normal);
}
.input-area button:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>