// src/stores/mindmapStore.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MindMapNode } from '@/services/mindMap'
import { generateMockMindMap } from '@/services/mindMap'

export const useMindmapStore = defineStore('mindmap', () => {
  // 存储思维导图数据
  const mindMapData = ref<MindMapNode | null>(null)
  // 加载状态
  const isLoading = ref(false)
  // 错误信息
  const errorMessage = ref('')

  // 设置数据（用于 AI 生成或本地生成）
  function setData(data: MindMapNode | null) {
    mindMapData.value = data
  }

  // 设置加载状态
  function setLoading(loading: boolean) {
    isLoading.value = loading
  }

  // 设置错误信息
  function setError(msg: string) {
    errorMessage.value = msg
  }

  // 清空数据
  function clearData() {
    mindMapData.value = null
    errorMessage.value = ''
  }

  // 本地生成（基于当前知识库）
  function generateLocal() {
    try {
      const data = generateMockMindMap()
      setData(data)
      setError('')
    } catch (e) {
      setError((e as Error).message)
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
    generateLocal
  }
})