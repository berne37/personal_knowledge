<template>
  <div v-if="data" class="mindmap-wrapper">
    <div ref="mindMapContainer" class="mindmap-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import MindMapLib from 'simple-mind-map'
// chats: 导出 PNG 需要 Export 插件——库本体不自带，usePlugin 注册一次即可（静态方法，全局生效）
import Export from 'simple-mind-map/src/plugins/Export.js'
MindMapLib.usePlugin(Export)
import type { MindMapNode } from '@/services/mindMap'

// chats: 配色对齐设计令牌——simple-mind-map 的主题配置是 JS 对象不是 CSS，
// 读不到 var(--color-primary)，只能写与 tokens.css 同值的字面量（同 ProjectGraph 状态色的做法）。
// 改令牌色值时记得同步这三行。
const PRIMARY = '#3b82f6'
const TEXT = '#2c3e50'
const TEXT_SECONDARY = '#606266'

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

// chats: 放大/缩小/导出——给页面顶部的浮动工具条用（2026-10-10 参考截图定稿），
// 组件只暴露动作，按钮布局归视图层管
function zoomIn() {
  try {
    mindMapInstance?.view?.enlarge?.()
  } catch (_) {
    /* 忽略 */
  }
}
function zoomOut() {
  try {
    mindMapInstance?.view?.narrow?.()
  } catch (_) {
    /* 忽略 */
  }
}
// 导出 PNG：文件名调用方给（默认思维导图）；失败往上抛，由视图层统一走 errorMessage 展示
async function exportPng(name = '思维导图') {
  await mindMapInstance?.export?.('png', true, name)
}

defineExpose({ zoomIn, zoomOut, resetView, exportPng })

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

    mindMapInstance = new MindMapLib({
      el: container,
      data: data,
      layout: 'logicalStructure', // 逻辑结构图（子节点向右展开）
      theme: 'default', // 只能填库已注册的主题名（只有 default），配色靠下面 themeConfig 覆盖
      // chats: 配色对齐全站设计令牌（tokens.css）。原写法 theme: 'primary' 是个不存在的
      // 主题名，实际一直走 default 主题——根节点/连线是库自带的青绿色 #549688，
      // 和主色 #3b82f6 完全是两套色。这里按「根节点主色实心、二级白底蓝边、
      // 下级文字降一档」覆盖，与知识库卡片的层次一致。
      themeConfig: {
        backgroundColor: 'transparent',
        // chats: 主题默认把 backgroundColor('#fafafa') 以内联样式写到容器上（Style.js 的
        // setBackgroundStyle），这就是导图外面那层「基础卡片」——内联样式优先级高于任何
        // 选择器，CSS 里写 background: transparent 压不住，只能从主题配置这头关掉。
        lineColor: PRIMARY, // 连线
        generalizationLineColor: PRIMARY, // 概要连线
        root: {
          fillColor: PRIMARY, // 根节点 = 主色实心
          borderRadius: 8,
        },
        second: {
          fillColor: '#fff', // 二级节点 = 白底卡片
          color: TEXT,
          borderColor: PRIMARY,
          borderRadius: 8,
        },
        node: {
          color: TEXT_SECONDARY, // 三级及以下文字降一档
        },
      },
      enableFreeDrag: true, // 允许拖拽单个节点
      // chats: 视图的平移/缩放完全交给库内部机制，不再自己量尺寸、算偏移——
      // 之前那套「量包围盒 + setTransformData」和库的内部变换互相打架，
      // 表现为拖动/滚轮后图整个跑出视口（消失）、只渲染一半。
      draggable: true, // 画布可拖拽平移
      // chats: 滚轮统一 = 缩放（2026-10-10 定稿）。早先改 'move' 是怕「缩放把图滚没了」，
      // 实际用下来平移反而不顺手——放大缩小是看图的主操作，平移交给拖拽就够了
      mousewheelAction: 'zoom',
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

/* chats: 旧的右下角「复位」小按钮已撤——复位入口上移到视图层浮动工具条的「适应窗口」，
   按钮的布局归视图层管，组件只保留画布本体 */
</style>
