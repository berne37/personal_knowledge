import './assets/main.css'

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
