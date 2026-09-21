// 接回统一的配置读写层（aiConfig.ts）。
// 设置页（SettingsView）把用户填的 key / 模型 / 地址写到 localStorage 键
// 'my-knowledge-assistant:ai-settings'（字段 apiKey / model / baseURL / mindmapModel），
// resolveAiConfig() 负责把「用户设置 > .env > 默认值」合并后返回。
// 这样用户在设置页填的东西才能真正生效（之前 ai.ts 读的是另一个键，等于没接上）。
import { resolveAiConfig } from './aiConfig'

function getAIConfig() {
  const cfg = resolveAiConfig()
  return {
    // 字段名沿用 ai.ts 内部旧命名（apiBase / model），避免改动两处调用点；
    // 真正的来源统一走 aiConfig.ts。
    apiKey: cfg.apiKey,
    apiBase: cfg.baseURL,
    model: cfg.chatModel,
    maxTokens: Number(import.meta.env.VITE_AI_MAX_TOKENS) || 8192,
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * 调用 AI API（流式响应）
 */
export async function streamChat(
  messages: ChatMessage[],
  onChunk: (chunk: string) => void,
  onComplete?: () => void,
  onError?: (error: Error) => void,
  model?: string,
) {
  const config = getAIConfig()

  if (!config.apiKey) {
    onError?.(new Error('请先配置 API Key（在设置页面填写）'))
    return
  }

  try {
    const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: model || config.model,
        messages: messages,
        stream: true,
        temperature: 0.7,
        max_tokens: config.maxTokens,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法读取响应体')
    }

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        if (trimmed === 'data: [DONE]') continue
        if (trimmed.startsWith('data: ')) {
          try {
            const json = JSON.parse(trimmed.slice(6))
            const content = json.choices?.[0]?.delta?.content
            if (content) {
              onChunk(content)
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    onComplete?.()
  } catch (error) {
    onError?.(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * 非流式调用（用于简单场景）
 */
export async function simpleChat(messages: ChatMessage[]): Promise<string> {
  const config = getAIConfig()

  if (!config.apiKey) {
    throw new Error('请先配置 API Key（在设置页面填写）')
  }

  const response = await fetch(`${config.apiBase}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      messages: messages,
      stream: false,
      temperature: 0.7,
      max_tokens: config.maxTokens,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`API 请求失败 (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}
