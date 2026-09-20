import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // 🔧 发布需要：部署到反向代理域名时，Vite preview 默认只认 localhost，
  // 会报「Blocked request. This host is not allowed.」。放开 host + allowedHosts 让线上可访问。
  server: {
    host: true,
    allowedHosts: true,
  },
  // 注意：不要对 pdfjs-dist 设 optimizeDeps.exclude。
  // 让 Vite 把 pdf.js 预打包成单一 chunk，主线程只有一份 class 实例，
  // 才能避免 fake worker 退化时「主线程双份 class → 私有字段跨副本读取」报错。
})
