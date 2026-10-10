import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

// 聊天会话的「读写层」。
//
// 为什么存 localStorage 而不是 IndexedDB：
// 对话是纯文本、量级小（个人使用几百 KB 封顶），localStorage 同步读写够用，
// 没必要为它开 objectStore；真正的大块头（附件文件句柄）已经在 IDB 里了。
//
// 为什么流式期间不落盘：回复是一个字一个字到的，每个 chunk 都写一遍
// localStorage 纯属浪费。只在回合结束（onComplete/onError）时整体写一次，
// 代价是流式中途关掉页面会丢掉最后半条回复——可接受。
//
// 会话是「懒创建」的：进页面不发消息就不建会话，避免历史列表里堆满
// 只有欢迎语的空「新对话」。

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatSession {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  messages: ChatMessage[]
}

export const WELCOME_TEXT = '我是你的本地知识助手。上传或选择资料后，我可以基于本地内容回答问题。'

const STORAGE_KEY = 'my-knowledge-assistant:chat-sessions'

function loadFromStorage(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const data = JSON.parse(raw) as ChatSession[]
    return Array.isArray(data) ? data : []
  } catch {
    // 存储损坏时不抛错，当没有历史处理，别让聊天页白屏
    return []
  }
}

export const useChatStore = defineStore('chat', () => {
  const sessions = ref<ChatSession[]>([])
  const activeId = ref<string | null>(null)

  // 历史侧栏的展开态放 store 而不是 ChatView：开关是侧边栏的「AI对话」按钮（App.vue），
  // 面板却在 ChatView 里——状态必须跨组件共享，放组件里谁也够不着谁
  const historyOpen = ref(false)

  function toggleHistory() {
    historyOpen.value = !historyOpen.value
  }

  const activeSession = computed(() => sessions.value.find((s) => s.id === activeId.value) ?? null)

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
    } catch {
      // 写满就算了：丢聊天记录不影响其它功能，不值得打断用户
    }
  }

  function createSession(): ChatSession {
    const now = new Date().toISOString()
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: '新对话',
      createdAt: now,
      updatedAt: now,
      messages: [{ role: 'assistant', content: WELCOME_TEXT }],
    }
    sessions.value.unshift(session)
    activeId.value = session.id
    persist()
    return session
  }

  // 有活跃会话就用，没有就现开一个（首次发消息 / 全部删光后的兜底）
  function ensureActiveSession(): ChatSession {
    return activeSession.value ?? createSession()
  }

  function appendMessage(msg: ChatMessage) {
    const session = ensureActiveSession()
    session.messages.push({ ...msg })
    // 标题自动化：第一条用户消息的前 20 个字，替代「新对话」
    if (session.title === '新对话' && msg.role === 'user') {
      session.title = msg.content.slice(0, 20) || '新对话'
    }
    session.updatedAt = new Date().toISOString()
    persist()
  }

  // 回合结束时调用：顺带刷新 updatedAt（侧栏按这个倒序排「最近聊过」）
  function persistActive() {
    const session = activeSession.value
    if (!session) return
    session.updatedAt = new Date().toISOString()
    persist()
  }

  function deleteSession(id: string) {
    sessions.value = sessions.value.filter((s) => s.id !== id)
    if (activeId.value === id) activeId.value = sessions.value[0]?.id ?? null
    persist()
  }

  function loadSessions() {
    sessions.value = loadFromStorage()
    // 活跃会话指向最近更新的一个；没有历史就先不开会话，等真正发消息再建
    const latest = [...sessions.value].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
    activeId.value = latest[0]?.id ?? null
  }

  loadSessions()

  return {
    sessions,
    activeId,
    activeSession,
    historyOpen,
    toggleHistory,
    createSession,
    ensureActiveSession,
    appendMessage,
    persistActive,
    deleteSession,
    loadSessions,
  }
})
