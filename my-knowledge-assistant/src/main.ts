// chats: 原先第一行是 `import './assets/main.css'`（Vite 脚手架样式，进而引入 base.css）。
// 那两个文件里真正生效的 reset / body 基础样式已合并进 style/global.css，脚手架文件随之删除，
// 项目现在只有一套样式入口：tokens.css（变量）+ global.css（全局基础与工具类）。
import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

//导入设计令牌(全局样式)
import './style/tokens.css'
import './style/global.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.mount('#app')
