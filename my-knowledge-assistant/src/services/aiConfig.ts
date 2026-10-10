// 用户 AI 配置的「读写层」。
//
// 为什么要单独搞这一层，而不是直接用 .env？
// .env 里的变量在 vite build 时就被「烧」进打包产物了，用户运行后改不了。
// 但「让用户自己填 key / 模型」是运行时的需求，所以必须把配置存到浏览器本地（localStorage），
// 运行时再读出来。这样既符合项目「local-first」的原则（key 只留在本机，不上传），
// 又能做到填完立即生效。
//
// 读取优先级：用户填的 > .env 里的 > 代码兜底默认值

export interface UserAiConfig {
  apiKey: string        // 用户自定义的 API Key
  model: string         // 对话默认模型
  baseURL: string       // API 地址（方便接 OpenAI 兼容的其他服务）
  mindmapModel: string  // 思维导图专用模型（留空则用对话模型）
}

const STORAGE_KEY = 'my-knowledge-assistant:ai-settings'

// 没有 localStorage 的环境（理论上只在 node 里）兜底，避免直接报错
function safeGet(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  } catch {
    return null
  }
}
function safeSet(v: string): void {
  try { typeof localStorage !== 'undefined' && localStorage.setItem(STORAGE_KEY, v) } catch {}
}
function safeRemove(): void {
  try { typeof localStorage !== 'undefined' && localStorage.removeItem(STORAGE_KEY) } catch {}
}

// 读取用户保存的配置（可能为空对象）
export function loadUserAiConfig(): Partial<UserAiConfig> {
  const raw = safeGet()
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Partial<UserAiConfig>
  } catch {
    return {}
  }
}

// 保存（覆盖写）
export function saveUserAiConfig(cfg: UserAiConfig): void {
  safeSet(JSON.stringify(cfg))
}

// 清除本地配置，恢复使用 .env 默认值
export function clearUserAiConfig(): void {
  safeRemove()
}

// 把「用户配置」和「.env」合并，得到当前真正生效的配置。
// 在 streamChat / mindMap 每次调用时读取，保证保存设置后立即生效。
export function resolveAiConfig() {
  const env = import.meta.env
  const user = loadUserAiConfig()
  return {
    // 用户填的优先；没有就取 .env；再没有就用代码兜底
    apiKey: user.apiKey || env.VITE_AI_API_KEY || '',
    baseURL: user.baseURL || env.VITE_AI_API_BASE || 'https://api.deepseek.com',
    // 对话模型：用户填的 > .env 的 VITE_AI_MODEL > 默认值
    // 🔧 修复：默认值原来是推理模型（v4-flash），思考会吃掉 max_tokens 且首字延迟长，
    // 对话体验差（久等 + 可能空回复）。默认改非推理模型，用户/.env 仍可覆盖。
    chatModel: user.model || env.VITE_AI_MODEL || 'deepseek-chat',
    // 思维导图专用模型：用户填的 > .env 的 VITE_MINDMAP_AI_MODEL > 空（空表示用对话模型）
    mindmapModel: user.mindmapModel || env.VITE_MINDMAP_AI_MODEL || '',
  }
}
