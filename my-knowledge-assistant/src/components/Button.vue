<template>
  <!-- 通用按钮组件，支持多种状态和样式 -->
  <button
    :class="buttonClasses"
    :disabled="disabled || loading"
    @click="handleClick"
    v-bind="$attrs"
  >
    <!-- 加载状态时显示旋转动画 -->
    <span v-if="loading" class="button__spinner">
      <div class="spinner"></div>
    </span>
    <!-- 正常状态显示按钮内容 -->
    <span v-else class="button__content">
      <slot />
    </span>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  type?: 'button' | 'submit' | 'reset';
  fullWidth?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'primary',
  size: 'md',
  disabled: false,
  loading: false,
  type: 'button',
  fullWidth: false
});

const emit = defineEmits<{
  click: [event: Event];
}>();

const buttonClasses = computed(() => {
  return [
    'button',
    `button--${props.variant}`,
    `button--${props.size}`,
    {
      'button--disabled': props.disabled || props.loading,
      'button--loading': props.loading,
      'button--full-width': props.fullWidth
    }
  ];
});

function handleClick(event: Event) {
  if (!props.disabled && !props.loading) {
    emit('click', event);
  }
}
</script>

<style scoped>
.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  border: none;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: inherit;
  position: relative;
  overflow: hidden;
}

.button--primary {
  background: var(--color-primary);
  color: white;
}

.button--primary:hover:not(.button--disabled) {
  background: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.button--secondary {
  background: var(--color-bg-hover);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.button--secondary:hover:not(.button--disabled) {
  background: var(--color-bg-border);
  transform: translateY(-1px);
}

.button--success {
  background: var(--color-success);
  color: white;
}

.button--success:hover:not(.button--disabled) {
  background: #28a745;
  transform: translateY(-1px);
}

.button--danger {
  background: var(--color-danger);
  color: white;
}

.button--danger:hover:not(.button--disabled) {
  background: #c0392b;
  transform: translateY(-1px);
}

.button--warning {
  background: var(--color-warning);
  color: white;
}

.button--warning:hover:not(.button--disabled) {
  background: #e67e22;
  transform: translateY(-1px);
}

.button--ghost {
  background: transparent;
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
}

.button--ghost:hover:not(.button--disabled) {
  background: var(--color-primary);
  color: white;
}

.button--sm {
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  border-radius: var(--radius-sm);
}

.button--md {
  padding: 10px 20px;
  font-size: var(--font-size-md);
}

.button--lg {
  padding: 12px 24px;
  font-size: var(--font-size-lg);
  border-radius: var(--radius-lg);
}

.button--disabled,
.button--loading {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none !important;
}

.button--full-width {
  width: 100%;
}

.button__content {
  display: flex;
  align-items: center;
  gap: 8px;
}

.button__spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 16px;
  height: 16px;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .button--secondary {
    background: #2d3748;
    color: #e2e8f0;
    border-color: #4a5568;
  }
  
  .button--secondary:hover:not(.button--disabled) {
    background: #4a5568;
  }
  
  .button--ghost {
    color: var(--color-primary);
    border-color: var(--color-primary);
  }
  
  .button--ghost:hover:not(.button--disabled) {
    background: var(--color-primary);
    color: white;
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .button--lg {
    padding: 10px 20px;
    font-size: var(--font-size-md);
  }
  
  .button--full-width {
    width: 100%;
  }
}
</style>