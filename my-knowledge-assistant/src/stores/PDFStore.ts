import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePDFStore = defineStore('pdf', () => {
  const pendingUrl = ref('')    // 待打开的 PDF（降级方案：Base64 data URL）
  const pendingName = ref('')   // 文件名
  const pendingHandle = ref<FileSystemFileHandle | null>(null) // 文件句柄（FSAA：只存句柄，重开时授权重读）

  // 详情页调用：把 PDF 放进来，然后跳转
  // handle 有值走 FSAA（不存内容），无值则 url 是 Base64 data URL（降级方案）
  function open(url: string, name: string, handle?: FileSystemFileHandle | null) {
    pendingUrl.value = url
    pendingName.value = name
    pendingHandle.value = handle ?? null
  }

  // PDFView 调用：取走并清空，避免下次进来又自动打开旧文件
  function consume() {
    const u = pendingUrl.value
    const h = pendingHandle.value
    pendingUrl.value = ''
    pendingHandle.value = null
    return { url: u, handle: h }
  }

  return { pendingUrl, pendingName, pendingHandle, open, consume }
})
