// src/stores/mindmapStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MindMapNode } from '@/services/mindMap'

// 全库导图的「读写层」。持久化模式照抄 chatStore（2026-10-13）：
// 为什么存 localStorage 而不是 IndexedDB——导图是纯 JSON 树、文本量级小，
// 同步读写够用，不必为它开 objectStore（条目级导图已经存在 item.mindmapData
// 里跟着知识库进 IDB，这里只兜全库导图页这份）。
//
// 为什么只在生成成功时落盘：setData(null) 是「重新生成前清内存」，不是用户
// 明确要删图——这时不能把上一张已保存的图抹掉，否则生成失败刷新后两头空。

const STORAGE_KEY = 'my-knowledge-assistant:mindmap-latest'

function loadFromStorage(): MindMapNode | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as MindMapNode
    // 存的是棵树，至少得像个节点（有 data.text）才敢用，防脏数据把渲染搞挂
    return data && typeof data.data?.text === 'string' ? data : null
  } catch {
    // 存储损坏时不抛错，当没有历史图处理，别让导图页白屏
    return null
  }
}

export const useMindmapStore = defineStore('mindmap', () => {
  // 存储思维导图数据（初始化时直接从 localStorage 读回，刷新不丢）
  const mindMapData = ref<MindMapNode | null>(loadFromStorage())
  // 加载状态
  const isLoading = ref(false)
  // 错误信息
  const errorMessage = ref('')

  // 设置数据（用于 AI 生成或本地生成）；非空时整体落盘一次
  function setData(data: MindMapNode | null) {
    mindMapData.value = data
    if (!data) return // null 只清内存，不碰已保存的图（见顶部说明）
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // 写满就算了：丢一张可重新生成的图，不值得打断用户
    }
  }

  // 设置加载状态
  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  // 设置错误信息
  function setError(msg: string) {
    errorMessage.value = msg
  }

  // 清空数据（显式清除：内存和已保存的图一起抹）
  function clearData() {
    mindMapData.value = null
    errorMessage.value = ''
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // 忽略：清不掉下次顶多看到旧图
    }
  }

  return {
    mindMapData,
    isLoading,
    errorMessage,
    setData,
    setLoading,
    setError,
    clearData,
  }
})
