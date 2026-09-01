<template>
  <li>
    <div class="item-info">
      <strong>{{ props.item.title }}</strong>
      <span class="desc">{{ props.item.description }}</span>
      <span class="level" :class="props.item.level">{{ props.item.level }}</span>
      <span class="date">{{ props.item.createdAt }}</span>
    </div>
    <button @click="handleDelete">删除</button>
  </li>
</template>

//defineProps 声明父组件必须传入 item 属性。
//模板中通过 props.item 访问数据（也可以解构，但会失去响应式，不推荐）。
数据流向：父组件 → 子组件（通过属性）。

<script setup lang="ts">
import type { KnowledgeItem } from '@/types';

// 父传子：用 props 接收数据
const props = defineProps<{
  item: KnowledgeItem;
}>();

// 子传父：用 emit 发送删除事件
const emit = defineEmits<{
  (e: 'delete', id: number): void;
}>();

function handleDelete() {
  emit('delete', props.item.id!);
}
</script>

<style scoped>
.item-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px var(--spacing-md);
  border-bottom: 1px solid var(--color-border-light);
}
.item-info {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}
.level {
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  color: #fff;
}
.level.已学会 { background: var(--color-success); }
.level.学习中 { background: var(--color-warning); }
.level.待学习 { background: var(--color-danger); }
.date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
</style>