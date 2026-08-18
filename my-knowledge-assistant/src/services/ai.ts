const API_BASE = import.meta.env.VITE_API_BASE ||'https://api.deepseek.com'
const API_KEY = import.meta.env.VITE_AI_API_KEY || ''
const MODEL = import.meta.env.VITE_AI_MODEL || 'deepseek-v4-flash'

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant'
    content: string
}

/**
 * 调用 AI API（流式响应）
 * @param messages 对话历史（包含 system prompt）
 * @param onChunk 每次收到数据块的回调
 * @param onComplete 完成回调
 * @param onError 错误回调
 */
export async function streamChat(
    messages: ChatMessage[],
    onChunk: (chunk: string) => void,
    onComplete?: () => void,
    onError?: (error: Error) => void
){
    if (!API_KEY) {
        onError?.(new Error(
            '请先配置 API Key（在 .env 文件中设置 VITE_AI_API_KEY）'))
            return
    }
    try {
        const response = await fetch (`${API_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${API_KEY}`
            },
            body: JSON.stringify({
                model: MODEL,
                messages: messages,
                stream: true,// 启用流式
                temperature: 0.7,
                max_tokens: 2048
            })
        })
        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`API 请求失败: ${response.status} 
                ${response.statusText} - ${errorText}`)
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
            //按行分割,处理sse格式
            const lines = buffer.split('\n')
            buffer = lines.pop() || ''//保留最后一行（可能不完整）
            for (const line of lines) {
                const trimmed = line.trim()
                if (!trimmed)continue
                if (trimmed === 'data: [DONE]') continue
                if (trimmed.startsWith('data: ')) {
                    try {
                        const json = JSON.parse(trimmed.slice(6))
                        const content = json.choices?.[0]?.delta?.content
                        if (content) {
                            onChunk(content)
                        }
                    } catch (e) {
                         // 忽略解析错误（可能是不完整的 JSON）
                        
                    }
                }
            }
        }
        onComplete?.()
    }catch (error) {
        // 确保传递的是 Error 对象
        onError?.(error instanceof Error ? error : new Error(String(error)))
    }
}
/**
 * 非流式调用（用于简单场景）
 */
export async function simpleChat(messages: ChatMessage[]): Promise<string> {
    if (!API_KEY) {
        throw new Error(
            '请先配置 API Key（在 .env 文件中设置 VITE_AI_API_KEY）')
    }
    const response = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify({
            model: MODEL,
            messages: messages,
            stream: false,
            temperature: 0.7,
            max_tokens: 2048
        })
    })
    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`API 请求失败 (${response.status}): ${errorText}`)
    }
    const data = await response.json()
    return data.choices?.[0]?.message?.content || ''
}