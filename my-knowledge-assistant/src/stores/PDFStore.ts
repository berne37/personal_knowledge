import { defineStore } from 'pinia'
import { ref } from 'vue'

export const usePDFStore = defineStore('pdf', () => {
  const pendingUrl = ref('')    // 待打开的 PDF
  const pendingName = ref('')   // 文件名

  // 详情页调用：把 PDF 放进来，然后跳转
  function open(url: string, name: string) {
    pendingUrl.value = url
    pendingName.value = name
  }

  // PDFView 调用：取走并清空，避免下次进来又自动打开旧文件
  function consume() {
    const u = pendingUrl.value
    pendingUrl.value = ''
    return u
  }

  return { pendingUrl, pendingName, open, consume }
})
