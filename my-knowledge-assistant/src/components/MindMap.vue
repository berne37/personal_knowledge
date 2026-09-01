<template>
    <div class="mindmap-wrapper">
        <div ref="mindMapContainer" class="mindmap-container"></div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted,watch, nextTick } from 'vue';
import MindMap from 'simple-mind-map';
import type { MindMapNode } from '@/services/mindMap'

const props = defineProps<{
    data: MindMapNode | null
}>()

const mindMapContainer = ref<HTMLElement | null>(null)
let mindMapInstance: any = null

    // 渲染思维导图
    function renderMIndMap(data: MindMapNode) {
        if (!mindMapContainer.value) return
    //如果已有实例,先销毁
    if (mindMapInstance) {
        mindMapInstance.destroy()
        mindMapInstance = null
    }
    // 创建新实例
    mindMapInstance = new MindMap({
    el: mindMapContainer.value,
    data: data,
    layout: 'logicalStructure', // 逻辑结构图（左右分布）
    theme: 'primary',           // 主题色
    enableFreeDrag: true,       // 允许自由拖拽
  })
}

// 监听数据变化
watch(() => props.data, (newData) => {
    if (newData) {
        nextTick(() => {
            renderMIndMap(newData)
        })
    }
}, { immediate: true })

//组件卸载时销毁实例
import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => {
    if (mindMapInstance) {
        mindMapInstance.destroy()
        mindMapInstance = null
    }
})
</script>

<style scoped>
.mindmap-wrapper {
  width: 100%;
  height: 100%;
  min-height: 500px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg-white);
  overflow: hidden;
}

.mindmap-container {
  width: 100%;
  height: 100%;
  min-height: 500px;
}
</style>