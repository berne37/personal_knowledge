<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
// chats: 全站弹窗外壳统一组件——知识库「新建条目」与项目「新建项目」原本各自复制了一份
// 一模一样的 overlay/modal 样式，且已经长歪（padding 一边 xl 一边 lg）。
// 外壳收敛到这里后：改弹窗外观只动一处，两页永远一致。
// 表单字段各页差异大，不做「万能表单」，内容继续走 slot 留在调用方。
import { onMounted, onUnmounted } from 'vue'

const emit = defineEmits<{ (e: 'close'): void }>()

// chats: Esc 关闭是模态框的标准交互，原先两个页面都没做，收敛后顺手补上
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal {
  background: var(--color-bg-white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  min-width: 400px;
  max-width: 90%;
  box-shadow: var(--shadow-xl);
}
/* chats: 标题约定——调用方在 slot 里直接写 h3，间距由外壳统一管 */
.modal :deep(h3) {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
}
</style>
