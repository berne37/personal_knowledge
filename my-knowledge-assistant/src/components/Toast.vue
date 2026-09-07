<template>
  <!-- Toast容器组件，用于替代alert提供更好的用户体验 -->
  <div class="toast" :class="type">
    <!-- 内容区域：图标 + 消息文字 -->
    <div class="toast-content">
      <span class="toast-icon">{{ getIcon() }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
    <!-- 关闭按钮（可选） -->
    <button v-if="canClose" @click="hide" class="toast-close">&times;</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

interface Props {
  message: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  canClose?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  type: 'info',
  duration: 3000,
  canClose: true
})

const isVisible = ref(false)
let timer: number | null = null

// 显示Toast
const show = () => {
  isVisible.value = true
  // 设置自动隐藏
  if (props.duration > 0) {
    timer = window.setTimeout(() => {
      hide()
    }, props.duration)
  }
}

// 隐藏Toast
const hide = () => {
  isVisible.value = false
  // 清理定时器
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
}

// ✨ 核心知识点：根据类型获取对应图标
const getIcon = () => {
  switch (props.type) {
    case 'success': return '✓'
    case 'error': return '✗'
    case 'warning': return '⚠'
    case 'info': return 'ℹ'
    default: return 'ℹ'
  }
}

// ✨ 核心知识点：生命周期钩子 - 组件挂载时显示
onMounted(() => {
  show()
})

// ✨ 核心知识点：生命周期钩子 - 组件卸载时清理
onUnmounted(() => {
  hide()
})

// ✨ 核心知识点：defineExpose 暴露方法给父组件
defineExpose({
  show,
  hide
})
</script>

<style scoped>
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  min-width: 300px;
  max-width: 500px;
  padding: 16px 20px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: space-between;
  animation: slideIn 0.3s ease-out;
}

.toast.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.toast.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.toast.warning {
  background: #fff3cd;
  color: #856404;
  border: 1px solid #ffeaa7;
}

.toast.info {
  background: #d1ecf1;
  color: #0c5460;
  border: 1px solid #bee5eb;
}

.toast-content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.toast-icon {
  font-weight: bold;
  font-size: 16px;
}

.toast-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
  opacity: 0.7;
  transition: opacity 0.2s;
}

.toast-close:hover {
  opacity: 1;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

@keyframes slideOut {
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
}
</style>