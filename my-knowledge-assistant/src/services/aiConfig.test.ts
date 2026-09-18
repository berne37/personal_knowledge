// 单元测试：resolveAiConfig 实现「用户配置 > .env > 代码默认值」三级合并。
// 为什么测它：这是项目里 AI 配置优先级的核心逻辑（面试能讲清），且是纯函数，不碰页面/网络，好测。
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  resolveAiConfig,
  saveUserAiConfig,
  clearUserAiConfig,
} from './aiConfig'

beforeEach(() => {
  // 每个用例前清空 localStorage，避免上一次 save 的配置串味
  localStorage.clear()
  // 把相关 env 全部压成空串作为「干净基线」。
  // 否则 vitest 会加载项目根目录的 .env，让 .env 里的值污染「无配置」用例，
  // 导致 resolveAiConfig 回落的是 .env 而非代码默认值。
  vi.stubEnv('VITE_AI_API_KEY', '')
  vi.stubEnv('VITE_AI_MODEL', '')
  vi.stubEnv('VITE_AI_API_BASE', '')
  vi.stubEnv('VITE_MINDMAP_AI_MODEL', '')
})
afterEach(() => {
  // 撤销所有 env stub，避免污染下一个用例
  vi.unstubAllEnvs()
})

it('用户配置优先于 .env 与默认值', () => {
  // 即便 .env 也配了，用户填的应该胜出
  vi.stubEnv('VITE_AI_API_KEY', 'env-key')
  vi.stubEnv('VITE_AI_MODEL', 'env-model')
  saveUserAiConfig({
    apiKey: 'user-key',
    model: 'user-model',
    baseURL: 'https://user.com',
    mindmapModel: 'user-mm',
  })
  const cfg = resolveAiConfig()
  expect(cfg.apiKey).toBe('user-key')
  expect(cfg.chatModel).toBe('user-model')
  expect(cfg.baseURL).toBe('https://user.com')
  expect(cfg.mindmapModel).toBe('user-mm')
})

it('用户未配置时回落到 .env', () => {
  vi.stubEnv('VITE_AI_API_KEY', 'env-key')
  vi.stubEnv('VITE_AI_MODEL', 'env-model')
  vi.stubEnv('VITE_AI_API_BASE', 'https://env.com')
  vi.stubEnv('VITE_MINDMAP_AI_MODEL', 'env-mm')
  const cfg = resolveAiConfig()
  expect(cfg.apiKey).toBe('env-key')
  expect(cfg.chatModel).toBe('env-model')
  expect(cfg.baseURL).toBe('https://env.com')
  expect(cfg.mindmapModel).toBe('env-mm')
})

it('均无配置时回落到代码默认值', () => {
  const cfg = resolveAiConfig()
  expect(cfg.apiKey).toBe('')
  expect(cfg.chatModel).toBe('deepseek-v4-flash')
  expect(cfg.baseURL).toBe('https://api.deepseek.com')
  expect(cfg.mindmapModel).toBe('')
})

it('用户只配置部分字段时，其余字段回落 env/默认', () => {
  vi.stubEnv('VITE_AI_MODEL', 'env-model')
  // 只填了 apiKey，其余留空字符串（等同于「没填」）
  saveUserAiConfig({ apiKey: 'user-key', model: '', baseURL: '', mindmapModel: '' })
  const cfg = resolveAiConfig()
  expect(cfg.apiKey).toBe('user-key')
  expect(cfg.chatModel).toBe('env-model') // model 空 → 用 env
  expect(cfg.baseURL).toBe('https://api.deepseek.com') // 无 env → 用代码默认
  expect(cfg.mindmapModel).toBe('') // 无 env → 用空串（表示「用对话模型」）
})

it('clearUserAiConfig 后恢复回落 .env', () => {
  vi.stubEnv('VITE_AI_API_KEY', 'env-key')
  saveUserAiConfig({ apiKey: 'user-key', model: 'm', baseURL: 'b', mindmapModel: 'mm' })
  clearUserAiConfig() // 模拟用户在设置页点了「清除」
  const cfg = resolveAiConfig()
  expect(cfg.apiKey).toBe('env-key')
})
