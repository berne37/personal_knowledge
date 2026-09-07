<template>
  <!-- 加载状态组件，用于显示加载动画和提示文字 -->
  <div class="loading-overlay" :class="{ 'loading-overlay--active': isActive }">
    <!-- 旋转动画的加载图标 -->
    <div class="loading-spinner">
      <div class="loading-spinner__circle"></div>
    </div>
    <!-- 加载提示文字（可选） -->
    <div class="loading-text" v-if="text">{{ text }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isActive: boolean;
  text?: string;
}

const props = withDefaults(defineProps<Props>(), {
  isActive: false,
  text: '加载中...'
});
</script>

<style scoped>
.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0.3s ease;
}

.loading-overlay--active {
  opacity: 1;
  visibility: visible;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  position: relative;
  margin-bottom: 16px;
}

.loading-spinner__circle {
  width: 100%;
  height: 100%;
  border: 3px solid #f3f3f3;
  border-top: 3px solid var(--color-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
  font-weight: 500;
}

/* 深色模式支持 */
@media (prefers-color-scheme: dark) {
  .loading-overlay {
    background: rgba(0, 0, 0, 0.8);
  }
  
  .loading-spinner__circle {
    border-color: #666;
    border-top-color: var(--color-primary);
  }
  
  .loading-text {
    color: var(--color-text-light);
  }
}
</style>