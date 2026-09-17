// 单元测试：extractMindMapJson 是思维导图的「JSON 抠取器」
// 为什么单独测它：它是纯函数（只吃字符串、吐对象，不碰页面/IndexedDB/网络），
// 而且历史上是 bug 重灾区（AI 回复格式五花八门），给它兜底逻辑上保险最划算。
import { describe, it, expect, vi } from 'vitest'
import { extractMindMapJson } from './mindMap'

// extractMindMapJson 本身不依赖 store，但 mindMap.ts 顶部 import 了 knowledgeStore，
// 而 knowledgeStore 一加载就会 openDB 连 IndexedDB（jsdom 环境里没有 indexedDB）。
// 单元测试只测 extractMindMapJson 这一个零件，所以把 store 这个依赖 mock 成空壳，
// 不让它真的去连库——这就是「隔离被测单元」的标准做法。
vi.mock('@/stores/knowledgeStore', () => ({
  useKnowledgeStore: () => ({ items: [] }),
}))

describe('extractMindMapJson', () => {
  // ① 最理想情况：AI 老老实实返回干净 JSON
  it('干净 JSON 直接解析', () => {
    const raw = '{"data":{"text":"Vue3"},"children":[{"data":{"text":"组合式 API"}}]}'
    const r = extractMindMapJson(raw)
    expect(r.data.text).toBe('Vue3')
    expect(r.children[0].data.text).toBe('组合式 API')
  })

  // ② 用 ```json 代码块包裹（deepseek 常见习惯）
  it('去掉 ```json 代码块包裹', () => {
    const raw = '```json\n{"data":{"text":"根"},"children":[]}\n```'
    const r = extractMindMapJson(raw)
    expect(r.data.text).toBe('根')
  })

  // ③ 前后带一句人话废话（靠括号配平截取兜底）
  it('兜住前后带废话的回复', () => {
    const raw = '好的，这是导图：{"data":{"text":"根"},"children":[]} 结束'
    const r = extractMindMapJson(raw)
    expect(r.data.text).toBe('根')
  })

  // ④ 推理模型把思考写进 <think> 块
  it('去掉 <think> 思考块', () => {
    const raw = '<think>让我想想</think>{"data":{"text":"根"},"children":[]}'
    const r = extractMindMapJson(raw)
    expect(r.data.text).toBe('根')
  })

  // ⑤ 没给 children 也要容错成空数组，调用方才不用判空
  it('没有 children 时补成空数组', () => {
    const raw = '{"data":{"text":"根"}}'
    const r = extractMindMapJson(raw)
    expect(r.children).toEqual([])
  })

  // ⑥ 完全没内容：基本是推理把 token 预算吃光了
  it('空内容抛出可读错误', () => {
    expect(() => extractMindMapJson('')).toThrow(/未返回内容/)
  })

  // ⑦ 不是合法 JSON
  it('非法 JSON 抛出格式错误', () => {
    expect(() => extractMindMapJson('一堆不是 json 的字')).toThrow(/格式不正确/)
  })

  // ⑧ 结构不对：有 JSON 但缺根节点 text
  it('缺根节点 text 时抛出错误', () => {
    expect(() => extractMindMapJson('{"foo":1}')).toThrow(/根节点 text/)
  })
})
