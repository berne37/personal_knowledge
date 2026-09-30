<template>
  <div class="chat-container">
    <!-- chats: 仿参考稿改版——顶部标题栏 + 居中对话列 + 底部圆角输入条 -->
    <div class="chat-header">AI 对话</div>

    <div class="message-list" ref="messageListRef">
      <div class="chat-thread">
        <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
          <!-- AI = 浅色圆底灯泡图标；用户 = 深色方底对话气泡图标（行内 SVG，不引图标库） -->
          <div v-if="msg.role === 'assistant'" class="message-avatar ai">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18h6" />
              <path d="M10 21h4" />
              <path d="M12 3a6 6 0 0 0-4 10c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2a6 6 0 0 0-4-10z" />
            </svg>
          </div>
          <div v-else class="message-avatar user">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <div class="message-content">{{ msg.content }}</div>
        </div>
        <div v-if="isLoading" class="message assistant">
          <div class="message-avatar ai">
            <svg
              viewBox="0 0 24 24"
              width="15"
              height="15"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18h6" />
              <path d="M10 21h4" />
              <path d="M12 3a6 6 0 0 0-4 10c.6.6 1 1.2 1 2h6c0-.8.4-1.4 1-2a6 6 0 0 0-4-10z" />
            </svg>
          </div>
          <div class="message-content typing">
            <span></span><span></span><span></span>AI 正在思考...
          </div>
        </div>
      </div>
    </div>

    <div class="input-wrap">
      <div class="input-area">
        <input
          v-model="inputText"
          placeholder="输入问题，按 Enter 发送..."
          @keyup.enter="sendMessage"
          :disabled="isLoading"
        />
        <button
          class="send-btn"
          @click="sendMessage"
          :disabled="isLoading || !inputText.trim()"
          aria-label="发送"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { streamChat, type ChatMessage } from '@/services/ai'
// chats: useKnowledgeStore 的 import 原先写在文件中部，归位到顶部 import 区
import { useKnowledgeStore } from '@/stores/knowledgeStore'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const messages = ref<Message[]>([
  // chats: 开场白只留一条 AI 欢迎语——原来「用户你好我是用户 + AI 回话」两条假消息是早期占位，不像真实对话
  {
    role: 'assistant',
    content: '我是你的本地知识助手。上传或选择资料后，我可以基于本地内容回答问题。',
  },
])

const inputText = ref('')
const isLoading = ref(false)
const messageListRef = ref<HTMLElement | null>(null)

// 知识库数据：sendMessage 时拼进系统提示词，让 AI 基于本地资料作答
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
  const knowledgeContext =
    knowledgeStore.items.length > 0
      ? `以下是用户知识库中的内容，请基于这些信息回答问题：\n${knowledgeStore.items
          .map((item) => `- ${item.title}：${item.description}（掌握程度：${item.level}）`)
          .join('\n')}`
      : '用户暂无知识库内容，请用通用知识回答。'

  // 构建完整的消息历史（含系统提示词）
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `你是一个知识助手。${knowledgeContext}\n回答时请保持亲切、专业。`,
  }

  // 将系统提示词放在消息历史的最前面
  const history: ChatMessage[] = [
    systemPrompt,
    ...messages.value.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
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
    },
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
/* chats: /chat 走 content--flush（App.vue padding:0），这里自己顶格铺满整屏；整页用卡片同款白底 */
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-white);
}

/* 顶部标题栏：白底 + 底部细线，顶格通栏（内边距自己给，因为内容区 padding 已归零） */
.chat-header {
  padding: var(--spacing-md) var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-white);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  flex-shrink: 0;
}

.message-list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-lg) var(--spacing-md);
}

/* 对话列居中，宽度和底部输入条对齐 */
.chat-thread {
  max-width: 780px;
  margin: 0 auto;
}

.message {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-lg);
  animation: fadeIn var(--transition-normal);
}

/* 用户消息整行反向：头像靠右、气泡靠右 */
.message.user {
  flex-direction: row-reverse;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar.ai {
  border-radius: var(--radius-full);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.message-avatar.user {
  border-radius: var(--radius-md);
  background: var(--color-text);
  color: #fff;
}

.message-content {
  padding: 10px 14px;
  border-radius: var(--radius-lg);
  max-width: 72%;
  line-height: 1.7;
  word-break: break-word;
  font-size: var(--font-size-md);
}

/* AI 气泡：浅灰底 + 细边框；用户气泡：更浅的灰、无边框（参考稿两方都不是彩色） */
.message.assistant .message-content {
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border);
}

.message.user .message-content {
  background: var(--color-bg);
}

/* 打字动画：三个点 + 「AI 正在思考...」 */
.typing span {
  display: inline-block;
  width: 4px;
  height: 4px;
  background: var(--color-text-placeholder);
  border-radius: var(--radius-full);
  margin-right: 3px;
  vertical-align: middle;
  animation: typing 1.4s infinite both;
}
.typing span:nth-child(2) {
  animation-delay: 0.2s;
}
.typing span:nth-child(3) {
  animation-delay: 0.4s;
}
.typing {
  color: var(--color-text-secondary);
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

/* 底部输入条：外层负责居中与贴底留白，内层是圆角容器（输入框 + 发送键同住一个框） */
.input-wrap {
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-md);
  flex-shrink: 0;
}

.input-area {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  max-width: 780px;
  margin: 0 auto;
  padding: 6px 6px 6px var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-bg-white);
  transition: border-color var(--transition-normal);
}
.input-area:focus-within {
  border-color: var(--color-primary);
}

.input-area input {
  flex: 1;
  border: none;
  outline: none;
  font-size: var(--font-size-md);
  background: transparent;
  color: var(--color-text);
}
.input-area input::placeholder {
  color: var(--color-text-placeholder);
}

/* 深色方形发送键，图标用行内 SVG 纸飞机 */
/* 发送键背景走全局主色令牌，不另起色值 */
.send-btn {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  transition: background var(--transition-normal);
}
.send-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}
.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
