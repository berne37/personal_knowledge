<template>
  <div v-if="data" class="mindmap-wrapper">
    <div ref="mindMapContainer" class="mindmap-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import MindMap from 'simple-mind-map'
import type { MindMapNode } from '@/services/mindMap'

const props = defineProps<{
  data: MindMapNode | null
}>()

const mindMapContainer = ref<HTMLElement | null>(null)
let mindMapInstance: any = null
let resizeObserver: ResizeObserver | null = null
// 暂存最新要渲染的数据：容器还没显示（尺寸为 0）时先攒着，等显示后再渲染
let pendingData: MindMapNode | null = null

// 容器此刻是否有有效尺寸（非 0）
function hasSize(): boolean {
  const el = mindMapContainer.value
  if (!el) return false
  const { width, height } = el.getBoundingClientRect()
  return width > 0 && height > 0
}

// chats: 渲染后让卡片尺寸跟随导图内容，整图原样完整显示、不被裁切。
// 读取 simple-mind-map 的实际内容包围盒，把外层 wrapper 撑到「内容尺寸 + 留白」，
// 再把内容平移到 (pad, pad) 起点（scale 保持 1，不缩放）。大图超出部分由外层 overflow:auto 滚动查看。
function adaptToContent() {
  const container = mindMapContainer.value
  if (!mindMapInstance || !container) return
  try {
    const rect = mindMapInstance.draw?.rbox?.()
    if (!rect || !isFinite(rect.width) || rect.width <= 0) {
      // chats: 取不到内容尺寸时兜底，缩放进视口至少保证完整可见
      mindMapInstance.view?.fit?.()
      return
    }
    const pad = 24
    const w = Math.ceil(rect.width + pad * 2)
    const h = Math.ceil(rect.height + pad * 2)
    container.style.width = w + 'px'
    container.style.height = h + 'px'
    // chats: 通知 simple-mind-map 重新读取容器尺寸，否则内部变换仍按旧尺寸计算
    mindMapInstance.resize?.()
    // chats: 把内容包围盒左上角平移到 (pad, pad)，整图从左上角完整铺开
    mindMapInstance.view?.setTransformData?.({
      state: { scale: 1, x: pad - (rect.x ?? 0), y: pad - (rect.y ?? 0) },
    })
  } catch (e) {
    // chats: 任何异常都回退 fit，确保「完整显示」这条底线不被打破
    try {
      mindMapInstance.view?.fit?.()
    } catch (_) {
      /* 忽略 */
    }
  }
}

// 真正初始化 simple-mind-map（仅在容器有尺寸时调用）
function doRender(data: MindMapNode) {
  const container = mindMapContainer.value
  if (!container) return
  if (!hasSize()) {
    // 容器还隐藏（比如被 v-show 收起的 tab），等 ResizeObserver 触发再渲染
    return
  }

  try {
    // 如果已有实例，先销毁，避免重复挂载到同一个 el 上冲突
    if (mindMapInstance) {
      mindMapInstance.destroy()
      mindMapInstance = null
    }

    mindMapInstance = new MindMap({
      el: container,
      data: data,
      layout: 'logicalStructure', // 逻辑结构图（子节点向右展开）
      // UI 微调：根节点默认会放在画布正中心，导致右侧子节点多、左侧空，
      // 整个树看起来偏右。把根节点初始位置定在左侧（x=80, y=垂直居中），
      // 让树从左往右生长，视觉更平衡，也减少右侧被截断的感觉。
      initRootNodePosition: [80, 'center'],
      theme: 'primary', // 主题色
      // chats: 主题默认把 backgroundColor('#fafafa') 以内联样式写到容器上（Style.js 的
      // setBackgroundStyle），这就是导图外面那层「基础卡片」——内联样式优先级高于任何
      // 选择器，CSS 里写 background: transparent 压不住，只能从主题配置这头关掉。
      themeConfig: { backgroundColor: 'transparent' },
      enableFreeDrag: true, // 允许自由拖拽
    })
    // chats: AI 重新生成或数据变化时，重新适配容器尺寸，避免新图被旧尺寸裁切
    mindMapInstance.on?.('data_change', adaptToContent)
    // chats: 渲染完成下一帧再适配（此时节点已落位，rbox 尺寸才真实）
    nextTick(adaptToContent)
  } catch (error) {
    console.error('渲染MindMap时出错:', error)
    mindMapInstance = null
  }
}

// 尝试渲染：有尺寸就渲染，没尺寸就等（ResizeObserver 会在可见时再次触发）
function tryRender(data: MindMapNode) {
  pendingData = data
  doRender(data)
}

onMounted(() => {
  // 用 ResizeObserver 盯着容器：当它的尺寸从 0 变成 >0（比如切到思维导图 tab、容器由 display:none 变回显示），
  // 就会回调，此时再初始化 simple-mind-map，彻底规避「容器宽高为0」的报错。
  const el = mindMapContainer.value
  if (el && 'ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => {
      if (hasSize() && pendingData && !mindMapInstance) {
        doRender(pendingData)
      }
    })
    resizeObserver.observe(el)
  }
  // 初始若已有数据且容器可见，直接渲染
  if (props.data) {
    tryRender(props.data)
  }
})

// 监听数据变化
watch(
  () => props.data,
  (newData) => {
    if (newData) {
      tryRender(newData)
    }
  },
  { immediate: true },
)

// 组件卸载时销毁实例与观察者
onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (mindMapInstance) {
    mindMapInstance.destroy()
    mindMapInstance = null
  }
})
</script>

<style scoped>
/* chats: 不再固定高度/隐藏溢出。宽度交给 JS 按内容撑开（max-content），
   外层（KnowledgeDetailView 的 .mindmap-container）负责 overflow:auto 滚动。
   margin: auto 是「小图居中、大图可滚」的关键：外层是 flex，图比视口小时
   auto 外边距把它推到正中，比视口大时 auto 解析为 0、照常从左上滚动
   （用 justify-content: center 会在大图时把左侧滚出可视区，永远滚不回来）。 */
.mindmap-wrapper {
  width: max-content;
  margin: auto;
  min-height: 300px;
}

.mindmap-container {
  width: 100%;
  min-height: 300px;
  overflow: visible; /* 内容由 JS 平移进容器内，不靠自身滚动 */
}
</style>
