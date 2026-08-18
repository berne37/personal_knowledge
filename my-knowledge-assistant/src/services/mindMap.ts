import { streamChat,type ChatMessage } from "./ai";
import {useKnowledgeStore} from "@/stores/knowledgeStore";

//思维导图节点类型
export interface MindMapNode {
    data:{
        text:string,
    }
    children?:MindMapNode[]
}

/**
 * 从知识库生成思维导图数据（模拟版 - 用于测试）
 */
export function generateMockMindMap(): MindMapNode {
    const store = useKnowledgeStore()
    const items = store.items

    if (items.length === 0) {
    return {
      data: { text: '知识库为空，请先添加技能' },
      children: []
        }
    }

     // 构建树：根节点 -> 按掌握程度分组
     const root: MindMapNode = {
    data: { text: '我的知识库' },
    children: []
  }
   // 按掌握程度分组
   const groups: Record<string, MindMapNode> = {
    '已学会' : {data: { text: '已学会' }, children: []},
    '学习中' : {data: { text: '学习中' }, children: []},
    '未学会' : {data: { text: '未学会' }, children: []}
  }

  items.forEach(item => {
    const level = item .level || '待学习'
    const node : MindMapNode = {
      data: { text: `${item.title} {${item.description}}` }
    }
    if (groups[level]) {
      groups[level].children!.push(node)
    }
   })

   //将非空分组添加到根节点
   Object.values(groups).forEach(group => {
    if (group.children && group.children.length > 0) {
        root.children!.push(group)
    }
   })

   return root
}

/**
 * 使用 AI 生成思维导图（基于知识库）
 */
export async function generateMindMapWithAI(
    onCHunk?: (chunk: string) => void,
    onComplete?: (data: MindMapNode) => void,
    onError?: (error: Error) => void
) {
    const store = useKnowledgeStore()
    const items = store.items

    if (items.length === 0) {
        onError?.(new Error('知识库为空，请先添加技能或资料'))
        return
    }

    // 构建知识库文本
    const knowledgeText = items.map(item => 
         `-${item.title}: ${item.description} (掌握程度:${item.level })`
        ).join('\n')

      // 系统提示词：让 AI 生成树形 JSON
      const systemPrompt:ChatMessage = {
        role: 'system',
        content: `
        你是一个知识梳理专家。请根据用户提供的知识库内容，生成一棵思维导图的树形结构数据。
        要求:
        1.输出格式必须是合法的JSON,结构如下:
        {
          "data": { "text": "根节点名称" },
          "children": [
            {
              "data": { "text": "子节点1" },
              "children": [...]
              }
          ]
        }
        2.根节点名称为"我的知识库"。
        3. 第一层子节点按掌握程度分组（"已学会"、"学习中"、"待学习"）。
        4. 每个技能/资料作为一个叶子节点，节点文本包含名称和简要描述。
        5. 只输出 JSON，不要添加任何解释文字。

        知识库内容:
        ${knowledgeText}`
  }
  const messages: ChatMessage[] = [systemPrompt]

  let fullResponse = ''

  await streamChat(
    messages,
    (chunk) => {
        fullResponse += chunk
        onCHunk?.(chunk)
    },
    () => {
        // 尝试解析 JSON
        try {
              // 有时候 AI 会输出 ```json ... ``` 包裹，需要提取
              let jsonStr = fullResponse.trim()
              const codeBlockMatch = jsonStr.match(/```json([\s\S]*?)```/i)
              if (codeBlockMatch && codeBlockMatch[1]) {
                  jsonStr = codeBlockMatch[1].trim()
              }
              const data = JSON.parse(jsonStr)
              onComplete?.(data)
        } catch (e) {
            onError?.(new Error('AI 返回的数据格式不正确，请重试'))
        }
    },
    (error) => {
        onError?.(error)
    }
)
}