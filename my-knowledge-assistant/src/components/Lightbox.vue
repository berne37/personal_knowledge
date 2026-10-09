<template>
  <Teleport to="body">
    <div v-if="src" class="lightbox-overlay" @click.self="close" @wheel.prevent="onWheel">
      <img
        :src="src"
        class="lightbox-img"
        :style="imgStyle"
        draggable="false"
        @click.stop="toggleZoom"
        @pointerdown="startDrag"
      />
      <button class="lightbox-close" @click="close">×</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// chats: 轻量看图器（参照 viewerjs 的交互：滚轮缩放 / 拖拽平移 / 点遮罩或 Esc 关闭）。
// 只做四件事，不引第三方库——local-first 项目依赖越少越好。
// 打开方式：父组件把 <img> 的 src 传进来（v-model:src 风格的单向 props + close 事件）。
import { computed, ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{ src: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

// chats: scale=1 是「适应窗口」（CSS max-width/max-height 90% 兜底），
// transform 只是叠加缩放和平移，图片本身始终居中
const scale = ref(1)
const x = ref(0)
const y = ref(0)
const dragging = ref(false)

const imgStyle = computed(() => ({
  transform: `translate(${x.value}px, ${y.value}px) scale(${scale.value})`,
  cursor: dragging.value ? 'grabbing' : 'zoom-in',
  // 拖拽中关掉过渡才跟手，其余时候过渡让缩放不生硬
  transition: dragging.value ? 'none' : 'transform 0.15s ease',
}))

function reset() {
  scale.value = 1
  x.value = 0
  y.value = 0
}

// 打开/换图时归位
watch(
  () => props.src,
  (v) => {
    if (v) reset()
  },
)

function onWheel(e: WheelEvent) {
  const factor = e.deltaY < 0 ? 1.2 : 1 / 1.2
  scale.value = Math.min(8, Math.max(0.2, scale.value * factor))
}

// 点击图片：在「适应窗口」和「放大 2.4 倍」之间切换（传统看图工具的习惯交互）
function toggleZoom() {
  if (scale.value > 1.01) {
    reset()
  } else {
    scale.value = 2.4
  }
}

let startX = 0
let startY = 0
function startDrag(e: PointerEvent) {
  dragging.value = true
  startX = e.clientX - x.value
  startY = e.clientY - y.value
  window.addEventListener('pointermove', onDragMove)
  window.addEventListener('pointerup', stopDrag)
}
function onDragMove(e: PointerEvent) {
  if (!dragging.value) return
  x.value = e.clientX - startX
  y.value = e.clientY - startY
}
function stopDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', onDragMove)
  window.removeEventListener('pointerup', stopDrag)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
window.addEventListener('keydown', onKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopDrag()
})

function close() {
  emit('close')
}
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  justify-content: center;
  align-items: center;
}
.lightbox-img {
  max-width: 90%;
  max-height: 90%;
  user-select: none;
  box-shadow: var(--shadow-xl);
}
.lightbox-close {
  position: absolute;
  top: 16px;
  right: 20px;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.lightbox-close:hover {
  background: rgba(255, 255, 255, 0.28);
}
</style>
