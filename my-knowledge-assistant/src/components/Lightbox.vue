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
      <button
        v-if="hasGallery"
        class="lightbox-nav lightbox-prev"
        title="上一张（←）"
        @click.stop="emit('nav', -1)"
      >
        ‹
      </button>
      <button
        v-if="hasGallery"
        class="lightbox-nav lightbox-next"
        title="下一张（→）"
        @click.stop="emit('nav', 1)"
      >
        ›
      </button>
      <button class="lightbox-close" @click="close">×</button>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// chats: 轻量看图器（参照 viewerjs 的交互：滚轮缩放 / 拖拽平移 / 点遮罩或 Esc 关闭）。
// 只做四件事，不引第三方库——local-first 项目依赖越少越好。
// 打开方式：父组件把 <img> 的 src 传进来（v-model:src 风格的单向 props + close 事件）。
// 多图模式（2026-10-09）：父组件额外传 images 列表，本组件只发 nav 事件，
// 「当前是第几张」的真相在父组件手里——组件自己不存索引，避免两处状态打架。
import { computed, ref, watch, onBeforeUnmount } from 'vue'

const props = defineProps<{ src: string; images?: string[] }>()
const emit = defineEmits<{ (e: 'close'): void; (e: 'nav', dir: 1 | -1): void }>()

// 列表多于一张才显示切换按钮/启用左右键
const hasGallery = computed(() => (props.images?.length ?? 0) > 1)

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

// chats: 缩放收口成一个函数——滚轮和 ↑↓ 方向键共用同一份步长和上下限，
// 改上限/步长只动这一处
function zoomBy(factor: number) {
  scale.value = Math.min(8, Math.max(0.2, scale.value * factor))
}

function onWheel(e: WheelEvent) {
  zoomBy(e.deltaY < 0 ? 1.2 : 1 / 1.2)
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

// chats: 键盘——Esc 关闭；←/→ 切图（多图模式才有）；↑/↓ 缩放（和滚轮同款步长）。
// 灯箱没开着（src 为空）时一律不响应，别劫持页面其它地方的键盘操作
function onKeydown(e: KeyboardEvent) {
  if (!props.src) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowLeft' && hasGallery.value) emit('nav', -1)
  else if (e.key === 'ArrowRight' && hasGallery.value) emit('nav', 1)
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    zoomBy(1.2)
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    zoomBy(1 / 1.2)
  }
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
/* chats: 左右切换按钮——垂直居中贴屏幕两侧，圆形半透明白（与关闭按钮同语言）；
   ‹› 字形比图片箭头轻量，够用 */
.lightbox-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 44px;
  height: 44px;
  border: none;
  border-radius: var(--radius-full);
  background: rgba(255, 255, 255, 0.14);
  color: #fff;
  font-size: 30px;
  line-height: 44px; /* ‹› 字形偏小，行高拉满让字符垂直居中 */
  text-align: center;
  padding: 0;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.lightbox-nav:hover {
  background: rgba(255, 255, 255, 0.28);
}
.lightbox-prev {
  left: 20px;
}
.lightbox-next {
  right: 20px;
}
</style>
