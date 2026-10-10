<template>
  <div class="settings-view">
    <h2>设置</h2>

    <p class="hint">
      这里填写的 API Key / 模型只会保存在你本机浏览器（localStorage），<strong>不会上传到任何服务器</strong>，
      填完点「保存」后立即生效，无需刷新页面。
    </p>

    <div class="form">
      <label>
        <span>API Key</span>
        <div class="input-row">
          <input
            :type="showKey ? 'text' : 'password'"
            v-model="form.apiKey"
            placeholder="sk-..."
            autocomplete="off"
          />
          <button type="button" class="link-btn" @click="showKey = !showKey">
            {{ showKey ? '隐藏' : '显示' }}
          </button>
        </div>
      </label>

      <label>
        <span>API 地址（Base URL）</span>
        <input
          v-model="form.baseURL"
          placeholder="https://api.deepseek.com"
          autocomplete="off"
        />
        <small>接 OpenAI 兼容的其他服务时改这里，比如本地 Ollama、硅基流动等。</small>
      </label>

      <label>
        <span>对话模型</span>
        <input
          v-model="form.model"
          placeholder="deepseek-v4-flash"
          autocomplete="off"
        />
        <small>默认是 .env 里的 VITE_AI_MODEL。</small>
      </label>

      <label>
        <span>思维导图专用模型（可选）</span>
        <input
          v-model="form.mindmapModel"
          placeholder="留空则使用「对话模型」"
          autocomplete="off"
        />
        <small>生成思维导图是结构化 JSON 任务，用非推理模型（如 deepseek-chat）会快很多。</small>
      </label>

      <div class="actions">
        <button class="primary" :disabled="saving" @click="save">保存</button>
        <button :disabled="testing" @click="testConnection">
          {{ testing ? '测试中...' : '测试连接' }}
        </button>
        <button class="ghost" @click="reset">恢复默认（清除本地配置）</button>
      </div>

      <p v-if="message" class="message" :class="messageType">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import {
  loadUserAiConfig,
  saveUserAiConfig,
  clearUserAiConfig,
  type UserAiConfig,
} from '@/services/aiConfig'

// 表单初始值：从 localStorage 读已保存的（没有就空字符串）
const saved = loadUserAiConfig()
const form = reactive<UserAiConfig>({
  apiKey: saved.apiKey || '',
  model: saved.model || '',
  baseURL: saved.baseURL || '',
  mindmapModel: saved.mindmapModel || '',
})

const showKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const message = ref('')
const messageType = ref<'ok' | 'err'>('ok')

// 统一的提示方法
function flash(msg: string, type: 'ok' | 'err') {
  message.value = msg
  messageType.value = type
}

// 保存：把表单值落盘到 localStorage；因为 ai.ts 每次调用都会读 localStorage，所以立即生效
function save() {
  saving.value = true
  saveUserAiConfig({ ...form })
  saving.value = false
  flash('✅ 已保存，下次对话 / 生成思维导图立即生效', 'ok')
}

// 测试连接：用「表单当前填的值」发一个最小请求，验证 key 是否可用（不要求先保存）
async function testConnection() {
  testing.value = true
  message.value = ''
  try {
    const base = form.baseURL.trim() || 'https://api.deepseek.com'
    const key = form.apiKey.trim()
    if (!key) {
      flash('请先填写 API Key 再测试', 'err')
      return
    }
    const res = await fetch(`${base}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: form.model.trim() || 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'hi' }],
        stream: false,
        max_tokens: 10,
      }),
    })
    if (res.ok) {
      flash('连接成功，配置可用', 'ok')
    } else {
      const t = await res.text()
      flash(`连接失败（${res.status}）：${t.slice(0, 200)}`, 'err')
    }
  } catch (e) {
    flash('请求出错：' + (e as Error).message, 'err')
  } finally {
    testing.value = false
  }
}

// 恢复默认：清掉 localStorage，表单也清空，回到读 .env 的状态
function reset() {
  clearUserAiConfig()
  form.apiKey = ''
  form.model = ''
  form.baseURL = ''
  form.mindmapModel = ''
  flash('已清除本地配置，恢复使用 .env 默认值', 'ok')
}
</script>

<style scoped>
.settings-view {
  max-width: 640px;
}
.hint {
  color: var(--color-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 20px;
}
label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-weight: 500;
}
label small {
  font-weight: 400;
  color: var(--color-text-placeholder);
  font-size: 12px;
}
input {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 14px;
  background: var(--color-bg-white);
  color: var(--color-text);
}
.input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}
.input-row input {
  flex: 1;
}
.link-btn {
  background: none;
  border: none;
  color: var(--color-primary);
  cursor: pointer;
  font-size: 13px;
  padding: 0 4px;
  white-space: nowrap;
}
.actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.actions button {
  padding: 10px 16px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  cursor: pointer;
  font-size: 14px;
  transition: background var(--transition-normal);
}
.actions button:hover:not(:disabled) {
  background: var(--color-bg-hover);
}
.actions .primary {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
}
.actions .ghost {
  color: var(--color-danger);
}
.message {
  margin-top: 4px;
  font-size: 14px;
}
.message.ok {
  color: #2e9e5b;
}
.message.err {
  color: var(--color-danger);
}
</style>
