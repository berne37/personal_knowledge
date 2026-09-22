<template>
  <ul v-if="props.items.length > 0" class="item-list">
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
  <!-- chats: 卡片化改版——空状态从裸文字改成虚线卡片，并补一句下一步该做什么的引导 -->
  <div v-else class="empty-hint">
    <p>还没有知识库条目</p>
    <span>点右上角「添加知识库」，记下第一个要学的东西</span>
  </div>
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
/* chats: 卡片化改版——列表从「紧贴的行」改为有间隙的卡片栈 */
.item-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.empty-hint {
  padding: var(--spacing-xl) var(--spacing-md);
  text-align: center;
  background: var(--color-bg-white);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
}
.empty-hint p {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
}
.empty-hint span {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}
</style>
