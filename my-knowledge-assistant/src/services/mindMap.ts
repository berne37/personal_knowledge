import { streamChat, type ChatMessage } from './ai'
import { resolveAiConfig } from './aiConfig'
import type { KnowledgeItem } from '@/types'

// 思维导图节点类型
export interface MindMapNode {
  data: {
    text: string
  }
  children?: MindMapNode[]
}

/**
 * 生成导图的「素材」类型。
 *
 * chats: 子条目已下线——单个条目的素材就是 标题/描述/掌握程度/笔记，
 * 树形的下一级由笔记承载（buildKnowledgeText 会把笔记按行拆成子节点素材）。
 * items 仅全库导图使用：把全部条目当作虚拟根的下一级喂给 AI，
 * 与知识条目的数据模型无关（不需要伪造 id / createdAt 等字段）。
 */
export type MindMapSource = Pick<KnowledgeItem, 'title' | 'description' | 'level'> & {
  notes?: string
  items?: MindMapSource[]
}

/**
 * 把条目树拍平成带缩进的文本。
 *
 * 缩进不是装饰：AI 看的是纯文本，没法直接理解树结构。
 * 用「缩进越深 = 层级越低」这种人一眼能看懂的格式，
 * AI 才能还原出谁是谁的子节点。
 *
 * 输出长这样：
 *   - Vue3（掌握程度：学习中）
 *     - 组合式 API（掌握程度：已学会）
 *     - 响应式原理（掌握程度：学习中）
 */
function buildKnowledgeText(node: MindMapSource, depth = 0): string {
  const indent = '  '.repeat(depth)
  const desc = node.description ? `：${node.description}` : ''
  let text = `${indent}- ${node.title}${desc}${node.level ? `（掌握程度：${node.level}）` : ''}\n`

  // chats: 子条目下线后，树形的下一级就是笔记——按行拆成子弹点（截行数/截长防 token 爆炸），
  // AI 依据这些笔记行组织导图层级，不再凭标题编内容
  if (node.notes?.trim()) {
    const noteLines = node.notes
      .trim()
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 15)
    for (const line of noteLines) {
      text += `${indent}  - 笔记：${line.slice(0, 200)}\n`
    }
  }

  // 仅全库导图使用：把全部条目当作虚拟根的下一级
  for (const child of node.items || []) {
    text += buildKnowledgeText(child, depth + 1)
  }
  return text
}

/**
 * 数素材里有多少个条目（仅全库视图用到 items）
 */
function countNodes(node: MindMapSource): number {
  return 1 + (node.items || []).reduce((sum, child) => sum + countNodes(child), 0)
}

/**
 * 使用 AI 生成思维导图
 *
 * 注意：这里不再自己去 store 读全库了 —— 数据由调用方传进来。
 * 好处是：
 *   1. 详情页可以只传「当前条目 + 它的子条目」，不会把整个知识库都喂给 AI
 *   2. service 层不再依赖 Pinia store，职责更干净，也更好单测
 *   3. 同一个函数既能服务单条目，也能服务全库视图（传虚拟根即可）
 */
export async function generateMindMapWithAI(
  source: MindMapSource,
  onChunk?: (chunk: string) => void,
  onComplete?: (data: MindMapNode) => void,
  onError?: (error: Error) => void,
) {
  if (!source?.title?.trim()) {
    onError?.(new Error('没有可生成导图的内容'))
    return
  }

  // chats: 子条目下线后，「有料」= 有描述、有笔记，或（全库视图）挂了条目
  const hasItems = countNodes(source) > 1
  const hasSource = Boolean(source.description?.trim() || source.notes?.trim()) || hasItems
  if (!hasSource) {
    onError?.(new Error('该条目还没有描述或笔记，没有可依据的资料——先补充内容再生成导图'))
    return
  }

  // 构建素材文本（当前条目 + 笔记行，或全库条目）
  const knowledgeText = buildKnowledgeText(source)

  // 系统提示词：让 AI 生成树形 JSON
  const systemPrompt: ChatMessage = {
    role: 'system',
    content: `你是一个知识梳理专家。请根据用户提供的知识条目，生成一棵思维导图的树形结构数据。

要求:
1. 输出格式必须是合法的 JSON，结构如下:
{
  "data": { "text": "根节点名称" },
  "children": [
    { "data": { "text": "子节点1" }, "children": [] }
  ]
}
2. 根节点的 text 必须是「${source.title}」，一个字都不要改。
3. ${
      hasItems
        ? '素材中的缩进表示父子层级（缩进越深层级越低）。请保留这种层级关系，并在此基础上整理出更清晰的中间分类；素材中没有的信息不要编造。'
        : '这个条目的树形下一级就是它的笔记（「笔记：」开头的行）。请把笔记内容组织成 2 到 3 层的结构；素材中没有的信息不要编造。'
    }
4. 每个叶子节点的文本要包含「名称」和「简要描述」，格式参考「组合式 API：setup 语法糖与响应式 API」。
5. 只输出 JSON，不要任何解释文字，也不要用 \`\`\` 代码块包裹。

知识条目:
${knowledgeText}`,
  }
  const messages: ChatMessage[] = [systemPrompt]

  let fullResponse = ''

  // 思维导图是「结构化 JSON 生成」任务，用非推理模型（deepseek-chat）比推理模型
  // （deepseek-v4-flash）快很多，也不会因为思考占满 token 导致返回空。
  // 优先用「设置页」里填的「思维导图专用模型」（resolveAiConfig 会从 localStorage 读），
  // 没填则回落到对话默认模型；之前这里只认 .env 变量，等于忽略了用户在设置页的配置。
  const mindMapModel = resolveAiConfig().mindmapModel || undefined

  await streamChat(
    messages,
    (chunk) => {
      fullResponse += chunk
      onChunk?.(chunk)
    },
    () => {
      // 尝试解析 JSON
      try {
        const data = extractMindMapJson(fullResponse)
        onComplete?.(data)
      } catch (e) {
        onError?.(e instanceof Error ? e : new Error('AI 返回的数据格式不正确，请重试'))
      }
    },
    (error) => {
      onError?.(error)
    },
    mindMapModel,
  )
}

/**
 * 从 AI 的原始回复里「抠」出思维导图 JSON。
 *
 * 为什么需要这么啰嗦：deepseek-v4-flash 是推理模型，回答习惯不稳定，
 * 可能返回这些「不干净」的形态：
 *   1. 用 ```json ... ``` 或 ``` ... ``` 代码块包裹
 *   2. 前后带一句人话解释（「好的，这是导图：{...}」）
 *   3. 推理模型偶尔把思考写在 <think>...</think> 里
 *   4. 最坑的一种：思考把 token 预算吃光，答案 JSON 根本没输出（fullResponse 为空）
 *
 * 所以这里做了多层兜底：去代码块 → 去 think 块 → 括号配平截取 → 校验结构。
 * 任何一步失败都抛出「看得懂」的错误，而不是笼统的「格式不正确」。
 */
export function extractMindMapJson(raw: string): MindMapNode {
  const text = (raw || '').trim()

  // 4. 完全没内容：基本是 token 预算被思考吃光了
  if (!text) {
    throw new Error(
      'AI 未返回内容（可能是推理消耗了 token 上限）。请重试，或把 .env 里的 max_tokens 调得更大。',
    )
  }

  let jsonStr = text

  // 1. 去掉 ```json / ``` 代码块包裹
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch && fenceMatch[1]) {
    jsonStr = fenceMatch[1].trim()
  }

  // 2. 去掉 <think>...</think> 思考块
  jsonStr = jsonStr.replace(/<think>[\s\S]*?<\/think>/gi, '').trim()

  // 3. 括号配平截取：找到第一个 { 或 [ 到最后一个 } 或 ]
  //    （用来兜住「好的，这是导图：{...}」这种前后带废话的情况）
  const openIdx = [jsonStr.indexOf('{'), jsonStr.indexOf('[')].filter((i) => i >= 0)
  const closeIdx = [jsonStr.lastIndexOf('}'), jsonStr.lastIndexOf(']')].filter((i) => i >= 0)
  const firstOpen = openIdx.length ? Math.min(...openIdx) : -1
  const lastClose = closeIdx.length ? Math.max(...closeIdx) : -1
  if (firstOpen >= 0 && lastClose > firstOpen) {
    jsonStr = jsonStr.slice(firstOpen, lastClose + 1)
  }

  let data: any
  try {
    data = JSON.parse(jsonStr)
  } catch {
    throw new Error('AI 返回的数据格式不正确，请重试（不是合法的 JSON）')
  }

  // 校验最小结构：必须能拿到根节点的 text
  const rootText = data?.data?.text
  if (typeof rootText !== 'string' || !rootText.trim()) {
    throw new Error('AI 返回的数据缺少根节点 text，请重试')
  }
  if (!Array.isArray(data.children)) {
    // 容错：没有 children 也允许（单个节点的导图）
    data.children = []
  }
  return data as MindMapNode
}
