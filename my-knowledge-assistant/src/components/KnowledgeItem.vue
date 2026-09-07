<template>
  <li>
    <!-- 显示模式 -->
    <div v-if="!isEditing" class="item-info">
      <strong>{{ props.item.title }}</strong>
      <!-- 修复：描述为空时由 UI 层显示占位文案，
           不再依赖数据库里存的 '无描述' 字面量（对应 KnowledgeForm.vue 的那处修复） -->
      <span class="desc">{{ props.item.description || '暂无描述' }}</span>
      <span class="level" :class="props.item.level">{{ props.item.level }}</span>
      <!-- 修复：原来直接插值 createdAt，会显示 2026-08-12T10:30:00.000Z 这种原始 ISO 串，
           现在统一走 formatDate() 格式化 -->
      <span class="date">{{ formatDate(props.item.createdAt) }}</span>
    </div>

    <!-- 编辑模式 -->
    <div v-else class="item-info edit-mode">
      <input v-model="editTitle" class="edit-input" placeholder="标题" />
      <input v-model="editDesc" class="edit-input" placeholder="描述" />
      <select v-model="editLevel" class="edit-select">
        <option value="已学会">已学会</option>
        <option value="学习中">学习中</option>
        <option value="待学习">待学习</option>
      </select>
    </div>

    <div class="item-actions">
      <!-- 显示模式下的按钮 -->
      <template v-if="!isEditing">
        <button class="btn-detail" @click="handleGoDetail">进入</button>
        <button class="btn-edit" @click="startEdit">编辑</button>
        <button class="btn-delete" @click="handleDelete">删除</button>
      </template>
 <!-- 编辑模式下的按钮 -->
      <template v-else>
        <button class="btn-save" @click="saveEdit">保存</button>
        <button class="btn-cancel" @click="cancelEdit">取消</button>
      </template>
    </div>
  </li>
</template>

// defineProps 声明父组件必须传入 item 属性。
// 模板中通过 props.item 访问数据（也可以解构，但会失去响应式，不推荐）。
// 数据流向：父组件 → 子组件（通过属性）。

// defineEmits 声明子组件可向父组件发送的事件。
// 数据流向：子组件 → 父组件（通过事件）。

<script setup lang="ts">
import type { KnowledgeItem } from '@/types';
import { ref } from 'vue';
import { useKnowledgeStore } from '@/stores/knowledgeStore';

const store = useKnowledgeStore();

// 父传子：用 props 接收数据
const props = defineProps<{
  item: KnowledgeItem;
}>();

// 子传父：用 emit 发送删除事件和进入事件
const emit = defineEmits<{
  (e: 'delete', id: number): void;
  (e: 'go-detail', item: KnowledgeItem): void;
  (e: 'updated'): void;
}>();

//新增编辑模式状态
const isEditing = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const editLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

function startEdit() {
  editTitle.value = props.item.title;
  editDesc.value = props.item.description || '';
  editLevel.value = props.item.level;
  isEditing.value = true;
}

async function saveEdit() {
  if (!editTitle.value.trim()) {
    alert('标题不能为空');
    return;
  }
  await store.updateItem(props.item.id!, {
    title: editTitle.value,
    description: editDesc.value,
    level: editLevel.value,
  });
  isEditing.value = false;
  emit('updated');
  emit('updated');   // 触发父组件刷新
}

function cancelEdit() {
  isEditing.value = false;
}

// 删除：向父组件发送 delete 事件
function handleDelete() {
  emit('delete', props.item.id!);
}

// 进入详情页：向父组件发送 go-detail 事件
function handleGoDetail() {
  emit('go-detail', props.item);
}

// 🔧 修复：列表页原先没有日期格式化函数，才会直接把 ISO 串渲染到页面上。
// TODO: 详情页 KnowledgeDetailView.vue 里有一份一模一样的 formatDate，
// 后续可以抽到 src/utils/date.ts 统一复用，避免两处各改各的。
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
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
.item-actions {
  display: flex;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}
.item-actions button {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.item-actions .btn-detail {
  background: var(--color-primary);
  color: #fff;
}
.item-actions .btn-detail:hover {
  background: var(--color-primary-hover);
}
.item-actions button:last-child {
  background: var(--color-danger);
  color: #fff;
}
.item-actions button:last-child:hover {
  background: #c0392b;
}
.item-info.edit-mode {
  gap: var(--spacing-sm);
}

.edit-input {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  min-width: 120px;
}
.edit-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

.edit-select {
  padding: 4px 8px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-bg-white);
}

.btn-edit {
  background: var(--color-warning);
  color: #fff;
}
.btn-edit:hover {
  background: #d68910;
}

.btn-save {
  background: var(--color-success);
  color: #fff;
}
.btn-save:hover {
  background: #2ecc71;
}

.btn-cancel {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.btn-cancel:hover {
  background: var(--color-border);
}
</style>