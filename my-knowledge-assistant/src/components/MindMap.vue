<template>
  <div v-if="data" class="mindmap-wrapper">
    <div ref="mindMapContainer" class="mindmap-container"></div>
    <button class="fit-btn" title="复位到整图可见" @click="resetView">复位</button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
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
// chats: 每份新数据只做一次自动 fit；之后用户拖拽/滚轮平移不被打断
let hasFitted = false

// 容器此刻是否有有效尺寸（非 0）
function hasSize(): boolean {
  const el = mindMapContainer.value
  if (!el) return false
  const { width, height } = el.getBoundingClientRect()
  return width > 0 && height > 0
}

// chats: 复位按钮——视图完全交给库内部平移后，用户可能把图拖出视野，
// 给一个一键回到「整图可见」的入口，比让用户凭手感拖回来可靠
function resetView() {
  try {
    mindMapInstance?.view?.fit?.()
  } catch (_) {
    /* 忽略 */
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
    hasFitted = false

    mindMapInstance = new MindMap({
      el: container,
      data: data,
      layout: 'logicalStructure', // 逻辑结构图（子节点向右展开）
      theme: 'primary', // 主题色
      // chats: 主题默认把 backgroundColor('#fafafa') 以内联样式写到容器上（Style.js 的
      // setBackgroundStyle），这就是导图外面那层「基础卡片」——内联样式优先级高于任何
      // 选择器，CSS 里写 background: transparent 压不住，只能从主题配置这头关掉。
      themeConfig: { backgroundColor: 'transparent' },
      enableFreeDrag: true, // 允许拖拽单个节点
      // chats: 视图的平移/缩放完全交给库内部机制，不再自己量尺寸、算偏移——
      // 之前那套「量包围盒 + setTransformData」和库的内部变换互相打架，
      // 表现为拖动/滚轮后图整个跑出视口（消失）、只渲染一半。
      draggable: true, // 画布可拖拽平移
      mousewheelAction: 'move', // 滚轮 = 平移视图（默认是缩放，缩放会把图滚没了）
      mousewheelMoveStep: 80, // 滚一下平移 80px
      initRootNodePosition: ['center', 'center'], // 根节点初始居中
    })
    // chats: 整棵树渲染完成后做一次自动 fit，保证新图初始整图可见；
    // 之后不再自动干预，用户的拖拽/平移状态不被打断
    mindMapInstance.on?.('node_tree_render_end', () => {
      if (!hasFitted) {
        hasFitted = true
        try {
          mindMapInstance?.view?.fit?.()
        } catch (_) {
          /* 忽略 */
        }
      }
    })
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
/* chats: 容器尺寸模型大改——不再让 JS 按内容撑开 wrapper（那套 max-content /
   min-width:100% / margin:auto 的组合是「消失 / 只渲染一半」的温床），
   现在 wrapper 永远填满外层给的区域，视图的平移缩放由库内部 transform 处理，
   外层不再出现滚动条。 */
.mindmap-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 300px;
  /* 思维导图页里 MindMap 是 flex column 的直接子元素，撑满剩余空间 */
  flex: 1;
  min-width: 0;
}

.mindmap-container {
  width: 100%;
  height: 100%;
  overflow: hidden; /* 平移由库内部 transform 完成，容器不需要滚动 */
}

/* chats: 复位按钮——悬浮在右下角，小而低调 */
.fit-btn {
  position: absolute;
  right: 12px;
  bottom: 12px;
  padding: 4px 12px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  /* 🔧 圆角从 --radius-full 药丸形改回 --radius-md（8px），全站按钮统一规格 */
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  cursor: pointer;
  box-shadow: var(--shadow-sm);
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}
.fit-btn:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}
</style>
