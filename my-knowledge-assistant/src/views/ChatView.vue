<template>
  <div class="chat-container">
    <!-- chats: 历史会话侧栏——开关在侧边栏的「AI对话」按钮上（App.vue，状态在 chatStore）；
         数据在 chatStore（localStorage 持久化） -->
    <aside class="history-panel" v-show="chatStore.historyOpen">
      <!-- chats: 顶行 = 节标题 + 搜索/收起图标按钮（DeepSeek 同款布局）；
           点搜索整行变成过滤输入框，Esc 退出 -->
      <div v-if="!isSearching" class="history-toolbar">
        <div class="history-caption">历史对话</div>
        <div class="history-actions">
          <button class="history-icon-btn" aria-label="搜索会话" @click="openSearch">
            <Search :size="14" :stroke-width="1.8" />
          </button>
          <button class="history-icon-btn" aria-label="收起历史" @click="chatStore.toggleHistory()">
            <PanelLeftClose :size="14" :stroke-width="1.8" />
          </button>
        </div>
      </div>
      <input
        v-else
        v-model="searchKeyword"
        ref="searchInputRef"
        class="history-search"
        placeholder="搜索会话，Esc 退出..."
        @keyup.esc="closeSearch"
      />
      <div class="history-list">
        <div
          v-for="s in filteredSessions"
          :key="s.id"
          class="history-item"
          :class="{ active: s.id === chatStore.activeId }"
          @click="switchSession(s.id)"
        >
          <span class="history-title">{{ s.title }}</span>
          <button class="history-del" @click.stop="removeSession(s.id)" aria-label="删除会话">
            ×
          </button>
        </div>
        <div v-if="!filteredSessions.length" class="history-empty">
          {{ isSearching ? '没有匹配的会话' : '暂无历史对话' }}
        </div>
      </div>
    </aside>

    <div class="chat-main">
      <div class="chat-header">
        <span>AI 对话</span>
        <button class="new-chat-btn" @click="startNewChat">＋ 新对话</button>
        <label class="focus-label">
          聚焦
          <select
            v-model="focusItemId"
            class="focus-select"
            :class="{ active: focusItemId !== '' }"
          >
            <option value="">全部知识库</option>
            <option v-for="opt in knowledgeOptions" :key="opt.id" :value="opt.id">
              {{ opt.label }}
            </option>
          </select>
        </label>
      </div>

      <div class="message-list" ref="messageListRef">
        <div class="chat-thread">
          <div v-for="(msg, index) in displayMessages" :key="index" :class="['message', msg.role]">
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
            <!-- chats: AI 消息走 markdown 渲染（模型默认输出 **加粗**/- 列表等排版符号，
               纯文本插值会原样糊出来）；用户消息保持纯文本 -->
            <div
              v-if="msg.role === 'assistant'"
              class="message-content md"
              v-html="renderMarkdown(msg.content)"
            ></div>
            <div v-else class="message-content">{{ msg.content }}</div>
          </div>
          <div v-if="showThinking" class="message assistant">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from 'vue'
import { streamChat, type ChatMessage } from '@/services/ai'
// chats: AI 回复按 markdown 渲染（html:false = 不解析内嵌 HTML，防止模型输出被注入标签）
import MarkdownIt from 'markdown-it'
// chats: useKnowledgeStore 的 import 原先写在文件中部，归位到顶部 import 区
import { useKnowledgeStore } from '@/stores/knowledgeStore'
// chats: 会话数据层——持久化 + 多会话管理都在 chatStore，本组件只管 UI
import { useChatStore, WELCOME_TEXT } from '@/stores/chatStore'
// chats: 抽屉顶行的搜索/收起图标（lucide 线性图标，和 DeepSeek 顶栏同款布局）
import { PanelLeftClose, Search } from 'lucide-vue-next'
// 🔧 修复：buildFocusContext 用了 KnowledgeItem 类型但没导入，vue-tsc 报 TS2304，
// 后面 map/filter 里的参数跟着变成隐式 any——一个缺导入连锁出三个错
import type { KnowledgeItem } from '@/types'

// chats: 对话状态整体搬进 chatStore（localStorage 持久化 + 多会话），本组件只留 UI 状态
const chatStore = useChatStore()

// 活跃会话的消息；还没有任何会话时用「虚拟欢迎消息」占位，首次发消息才真正建会话
const messages = computed<ChatMessage[]>(() => chatStore.activeSession?.messages ?? [])
const displayMessages = computed<ChatMessage[]>(() =>
  messages.value.length ? messages.value : [{ role: 'assistant', content: WELCOME_TEXT }],
)

// 侧栏按更新时间倒序（最近聊过的在最上）
const sortedSessions = computed(() =>
  [...chatStore.sessions].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
)

// chats: 会话搜索——只按标题匹配，大小写不敏感；没关键词时等于原列表
const isSearching = ref(false)
const searchKeyword = ref('')
const searchInputRef = ref<HTMLInputElement | null>(null)

const filteredSessions = computed(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return sortedSessions.value
  return sortedSessions.value.filter((s) => s.title.toLowerCase().includes(kw))
})

function openSearch() {
  isSearching.value = true
  // 等输入框渲染出来再聚焦，否则 ref 还是 null
  nextTick(() => searchInputRef.value?.focus())
}

function closeSearch() {
  isSearching.value = false
  searchKeyword.value = ''
}

function startNewChat() {
  chatStore.createSession()
}

function switchSession(id: string) {
  // 流式输出中切换也没事：流会继续写进原来那个会话（currentAssistantMessage 还指着那边）
  chatStore.activeId = id
  currentAssistantMessage = null
  // chats: 搜索是「找 → 点」的一次性流程，点中即完成——回到标题行，关键词一并清掉
  if (isSearching.value) closeSearch()
}

function removeSession(id: string) {
  chatStore.deleteSession(id)
}

const inputText = ref('')
const isLoading = ref(false)
const messageListRef = ref<HTMLElement | null>(null)

// chats: 「正在思考」只在还没等到首字时显示。首字一到列表里就有真实 AI 消息了，
// 动画再挂着就会出现「气泡 + 思考中」叠在一起的怪状态
const showThinking = computed(() => {
  const last = messages.value[messages.value.length - 1]
  return isLoading.value && (!last || last.role === 'user')
})

// chats: markdown 渲染器单例，页面整个生命周期共用一个实例
// breaks:true = 单个换行也断行（聊天场景习惯）；html:false = 模型输出里的 HTML 标签按纯文本转义，防注入
const md = new MarkdownIt({ breaks: true, html: false, linkify: false })

function renderMarkdown(text: string): string {
  return md.render(text || '')
}

// 知识库数据：sendMessage 时拼进系统提示词，让 AI 基于本地资料作答
const knowledgeStore = useKnowledgeStore()

// chats: 联动 demo 的「轻量上下文聚焦」——评审结论里「砍范围」的那版：
// 不做检索架构，只做「选中某个条目时，注入它的详情 + 知识关系 + 附件元数据」。
// 关系一并注入是「关系数据激活」的第二个消费出口：问一句「这个知识点的前置是什么」
// 就能看到详情页里手动声明的关系真的参与了 AI 回答。
const focusItemId = ref<number | ''>('')

// chats: 子条目已下线，下拉选项就是全库一层平铺
const knowledgeOptions = computed(() =>
  knowledgeStore.items.filter((k) => k.id != null).map((k) => ({ id: k.id!, label: k.title })),
)

// 聚焦上下文：详情（笔记截断防 token 爆炸）+ 关系标题 + 附件只给文件名（评审明确：全文塞上下文 = token 爆炸 + 幻觉）
function buildFocusContext(item: KnowledgeItem): string {
  const lines: string[] = []
  lines.push(`【聚焦条目】${item.title}（掌握程度：${item.level}）`)
  if (item.description) lines.push(`描述：${item.description}`)
  if (item.notes?.length) {
    // chats: 笔记一对多——每篇给「标题 + 正文」，整体截断防 token 爆炸
    const noteText = item.notes.map((n) => `【${n.title}】${n.content}`).join('\n')
    lines.push(
      `笔记：${noteText.slice(0, 1500)}${noteText.length > 1500 ? '…（笔记过长已截断）' : ''}`,
    )
  }
  const pre = (item.prerequisites || [])
    .map((id) => knowledgeStore.findItemById(id)?.title)
    .filter(Boolean)
  if (pre.length) lines.push(`前置知识：${pre.join('、')}`)
  const rel = (item.relatedKnowledge || [])
    .map((id) => knowledgeStore.findItemById(id)?.title)
    .filter(Boolean)
  if (rel.length) lines.push(`相关知识：${rel.join('、')}`)
  const atts = (item.attachments || []).map((a) => a.name)
  if (atts.length) lines.push(`相关附件（仅文件名）：${atts.join('、')}`)
  return lines.join('\n')
}

// 当前的 AI 回复消息（指向 store 会话里那条，流式期间原地累加内容）
let currentAssistantMessage: ChatMessage | null = null

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || isLoading.value) return

  // chats: 会话在首条用户消息时才真正创建（store 的 ensureActiveSession 兜底），
  // 标题自动取这条消息的前 20 个字
  chatStore.appendMessage({ role: 'user', content: text })
  inputText.value = ''
  scrollToBottom()

  isLoading.value = true

  // 构建知识库上下文
  // chats: 选中聚焦条目时，上下文从「全库一行摘要」换成「该条目详情 + 知识关系」；
  // 其余条目只保留一行标题清单，让 AI 知道全库还有什么但不必展开（省 token）
  const focusItem = focusItemId.value !== '' ? knowledgeStore.findItemById(focusItemId.value) : null
  const knowledgeContext = focusItem
    ? `用户当前正在学习以下知识条目，请优先基于它及其知识关系回答问题：\n${buildFocusContext(focusItem)}\n\n知识库其它条目一览：${knowledgeStore.items.map((i) => i.title).join('、') || '无'}`
    : knowledgeStore.items.length > 0
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
      // 首字到达才把 AI 消息写进 store（等待期由 isLoading 的「正在思考」节点负责）
      if (!currentAssistantMessage) {
        chatStore.appendMessage({ role: 'assistant', content: '' })
        currentAssistantMessage = messages.value[messages.value.length - 1] ?? null
      }
      if (currentAssistantMessage) {
        currentAssistantMessage.content += chunk
        scrollToBottom()
      }
    },
    // onComplete
    () => {
      // 🔧 修复：AI 一个字都没吐时（思考占满额度），就地写提示而不是留空气泡
      if (currentAssistantMessage && !currentAssistantMessage.content) {
        currentAssistantMessage.content = '（AI 没有返回内容，可能是思考占满了输出上限，请重试）'
      }
      // chats: 流式期间不落盘，回合结束整体写一次 localStorage
      chatStore.persistActive()
      isLoading.value = false
      currentAssistantMessage = null
      scrollToBottom()
    },
    // onError
    (error) => {
      console.error('AI 回复失败:', error)
      // 🔧 修复：错误发生在首字之前时原先什么都不显示（没有消息可写错误），
      // 现在就地创建一条错误消息，保证失败原因永远可见
      if (!currentAssistantMessage) {
        chatStore.appendMessage({ role: 'assistant', content: '' })
        currentAssistantMessage = messages.value[messages.value.length - 1] ?? null
      }
      if (currentAssistantMessage) {
        currentAssistantMessage.content = `❌ 出错了：${error.message}。请检查 API Key 或网络连接。`
      }
      chatStore.persistActive()
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
/* chats: 容器改横向布局——左侧历史侧栏 + 右侧对话主区。
   position:relative 是历史抽屉的定位锚：抽屉用 absolute 浮在对话区上，不占布局空间 */
.chat-container {
  position: relative;
  display: flex;
  height: 100vh;
  background: var(--color-bg-white);
}

.chat-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

/* 历史侧栏改为「抽屉」：absolute 浮在对话区上方（锚是 .chat-container），
   从顶栏下缘垂到页底，只遮挡不挤压——消息区和输入条都不会被推走。
   top 必须和 .chat-header 的高度一致，否则会盖住顶栏或露出缝。
   gap 收成 2px：首条对齐位 = padding 8 + 顶行高 22 + gap 2 = 32px，与原配平一致
   （顶行从 16 变 22 是因为多了图标按钮，两处高度联动，改一处要连带看） */
.history-panel {
  position: absolute;
  top: 52px;
  left: 0;
  bottom: 0;
  width: 160px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--spacing-sm);
  border-right: 1px solid var(--color-border);
  background: var(--color-bg-hover);
  box-shadow: var(--shadow-md);
}

/* chats: 抽屉顶行——节标题居左 + 搜索/收起幽灵按钮居右（DeepSeek 同款布局）。
   高度写死 22px 参与首条对齐配平 */
.history-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 22px;
}

.history-caption {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  padding: 0 10px;
}

/* 幽灵图标按钮：平时只有图标，hover 浮出底色——和侧边栏 hover 同一档色 */
.history-actions {
  display: flex;
  gap: 2px;
}
.history-icon-btn {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}
.history-icon-btn:hover {
  background: var(--color-bg-border);
  color: var(--color-text);
}

/* 搜索态：顶行整体换成过滤输入框，高度与按钮行一致，切换不跳动 */
.history-search {
  height: 22px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  padding: 0 8px;
  font-size: var(--font-size-xs);
  color: var(--color-text);
  outline: none;
}
.history-search:focus {
  border-color: var(--color-primary);
}
.history-search::placeholder {
  color: var(--color-text-placeholder);
}

.new-chat-btn {
  border: 1px solid var(--color-border);
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  padding: 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    color var(--transition-fast);
}
.new-chat-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary-dark);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 7px 10px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
}
.history-item:hover {
  background: var(--color-bg-border);
}
.history-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}

.history-title {
  /* chats: 标题色不在这里定——跟随 .history-item 的颜色（普通态深色 / 选中态主色），
     直接写在元素上会压过父级继承，导致「选中变蓝」失效 */
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 删除键默认隐藏，hover 条目才出现，避免一排 × 干扰视线 */
.history-del {
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
  padding: 0 2px;
  border-radius: 4px;
  visibility: hidden;
}
.history-item:hover .history-del {
  visibility: visible;
}
.history-del:hover {
  color: var(--color-danger);
}

.history-empty {
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
  text-align: center;
  padding: 12px 0;
}

/* 顶部标题栏：白底 + 底部细线，顶格通栏（内边距自己给，因为内容区 padding 已归零）。
   高度写死 52px：历史抽屉的 top 靠它对齐，两边必须一处定、一处跟 */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 52px;
  padding: 0 var(--spacing-lg);
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-white);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  flex-shrink: 0;
}

/* chats: 聚焦选择器——label 保持标题的 600 字重会压住下拉框文字，分离处理 */
.focus-label {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-weight: 400;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
}
.focus-select {
  /* chats: 药丸形下拉——appearance 干掉原生箭头，换成自绘 chevron（data URI，灰色跟随边框色系） */
  appearance: none;
  padding: 4px 26px 4px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  background-color: var(--color-bg-white);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888780' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  font-size: var(--font-size-xs);
  color: var(--color-text);
  max-width: 220px;
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast),
    background-color var(--transition-fast);
}
.focus-select:hover {
  background-color: var(--color-bg-hover);
}
.focus-select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
/* chats: 聚焦生效时（没选「全部知识库」）给出着色状态，一眼看出当前不是全库上下文 */
.focus-select.active {
  border-color: var(--color-primary);
  background-color: var(--color-bg-primary);
  color: var(--color-primary-dark);
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

/* chats: AI 气泡内的 markdown 元素排版——v-html 注入的内容不在 scoped 作用域里，
   必须用 :deep() 才能命中。strong 要显式加粗：global.css 的 * { font-weight: normal }
   会压掉标签默认字重，这是本项目已知的坑 */
.message-content.md :deep(p) {
  margin: 0 0 6px;
}
.message-content.md :deep(p:last-child) {
  margin-bottom: 0;
}
.message-content.md :deep(ul),
.message-content.md :deep(ol) {
  padding-left: 18px;
  margin: 4px 0;
}
.message-content.md :deep(li) {
  margin-bottom: 2px;
}
.message-content.md :deep(strong) {
  font-weight: 600;
}
.message-content.md :deep(h1),
.message-content.md :deep(h2),
.message-content.md :deep(h3),
.message-content.md :deep(h4) {
  font-weight: 600;
  font-size: var(--font-size-md);
  margin: 8px 0 4px;
}
.message-content.md :deep(code) {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 1px 5px;
  font-size: var(--font-size-sm);
  font-family: var(--font-mono, Consolas, monospace);
}
.message-content.md :deep(pre) {
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px 12px;
  overflow-x: auto;
  margin: 6px 0;
}
.message-content.md :deep(pre code) {
  background: none;
  border: none;
  padding: 0;
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
