<template>
  <div v-if="data" class="mindmap-wrapper">
    <div ref="mindMapContainer" class="mindmap-container"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue';
import MindMap from 'simple-mind-map';
import type { MindMapNode } from '@/services/mindMap';

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
            // 🎨 UI 微调：根节点默认会放在画布正中心，导致右侧子节点多、左侧空，
            // 整个树看起来偏右。把根节点初始位置定在左侧（x=80, y=垂直居中），
            // 让树从左往右生长，视觉更平衡，也减少右侧被截断的感觉。
            initRootNodePosition: [80, 'center'],
            theme: 'primary',           // 主题色
            enableFreeDrag: true,       // 允许自由拖拽
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
watch(() => props.data, (newData) => {
    if (newData) {
        tryRender(newData)
    }
}, { immediate: true })

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
.mindmap-wrapper {
  width: 100%;
  height: 600px;  /* 固定高度，确保有足够空间显示思维导图 */
  min-height: 600px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

.mindmap-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: auto;  /* 允许滚动 */
}
</style>
