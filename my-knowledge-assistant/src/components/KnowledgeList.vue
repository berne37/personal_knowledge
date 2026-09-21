<template>
  <ul class="item-list">
    <KnowledgeItem
      v-for="item in props.items"
      :key="item.id"
      :item="item"
      :expandedId="props.expandedId"
      @go-detail="$emit('go-detail', $event)"
      @delete="handleDelete"
      @updated="$emit('updated')"
    />
  </ul>
  <p v-if="props.items.length === 0">暂无技能，请添加。</p>
</template>

<script setup lang="ts">
import type { KnowledgeItem as KnowledgeItemType } from '@/types'
import KnowledgeItem from './KnowledgeItem.vue'

// 接收整个数组，再循环传给单个 KnowledgeItem
const props = defineProps<{
  items: KnowledgeItemType[]
  expandedId: number | null
}>()

// 把子组件的删除 / 进入详情事件透传给上层（KnowledgeView）
const emit = defineEmits<{
  (e: 'delete', id: number): void
  (e: 'go-detail', item: KnowledgeItemType): void
  (e: 'updated'): void
}>()

function handleDelete(id: number) {
  emit('delete', id)
}
</script>

<style scoped>
.item-list {
  list-style: none;
  padding: 0;
}
</style>
