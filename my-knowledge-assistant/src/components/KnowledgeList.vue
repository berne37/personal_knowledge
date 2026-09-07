<template>
  <ul class="item-list">
    <KnowledgeItem
      v-for="item in props.items"
      :key="item.id"
      :item="item"
      :expandedId="props.expandedId"
      @go-detail="$emit('go-detail', $event)"
      @delete="handleDelete"
    />
  </ul>
  <p v-if="props.items.length === 0">暂无技能，请添加。</p>
</template>

//在父组件中循环渲染子组件（v-for + :item 传值）。
//通过 @delete 监听子组件的删除事件，然后转发给更上层的父组件（KnowledgeView）。
//事件冒泡：KnowledgeItem → KnowledgeList → KnowledgeView。

<script setup lang="ts">
import type { KnowledgeItem as KnowledgeItemType } from '@/types';
import KnowledgeItem from './KnowledgeItem.vue';

// 父传子：接收整个数组
const props = defineProps<{
  items: KnowledgeItemType[];
  expandedId: number | null;
}>();

// 子传父：转发删除事件
const emit = defineEmits<{
  (e: 'delete', id: number): void;
  (e: 'go-detail', item: KnowledgeItemType): void;
}>();

function handleDelete(id: number) {
  emit('delete', id);
}
</script>

<style scoped>
.item-list {
  list-style: none;
  padding: 0;
}
</style>