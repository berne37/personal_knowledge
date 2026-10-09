<template>
  <div class="node-item">
    <div class="node-header">
      <button v-if="node.children?.length" class="expand-btn" @click="expanded = !expanded">
        {{ expanded ? '▼' : '▶' }}
      </button>
      <span class="node-title">{{ node.title }}</span>
      <span class="node-status" :class="node.status">{{ getStatusLabel(node.status) }}</span>
      <!-- 🔧 有子任务的节点显示「推导进度」（completed 恒 100 / 子任务平均），
           手填值只对叶子节点生效——否则行上显示手填 50%，项目进度却按子任务算，两套数字对不上 -->
      <span class="node-progress" :title="node.children?.length ? '进度由子任务平均得出' : ''">
        {{ store.getEffectiveProgress(node) }}%
      </span>
      <div v-if="node.attachments?.length" class="attachments">
        <div v-for="attachment in node.attachments" :key="attachment.id" class="attachment-item">
          <img
            v-if="attachment.type?.startsWith('image/')"
            :src="attachment.data"
            class="attachment-thumb"
            :alt="attachment.name"
          />
          <span class="file-name">{{ attachment.name }}</span>
          <button class="btn-icon" title="删除附件" @click="removeAttachment(attachment.id)">
            ×
          </button>
        </div>
      </div>
      <div class="node-actions">
        <button @click="showAddForm = !showAddForm">+ 子任务</button>
        <button @click="openEditForm">编辑</button>
        <button @click="triggerFilePicker">附件</button>
        <button @click="$emit('delete', node.id)">删除</button>
      </div>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="handleFileChange" />
    </div>

    <div v-if="showAddForm" class="add-child-form">
      <input v-model="childTitle" placeholder="子节点名称" />
      <input v-model.number="childProgress" type="number" min="0" max="100" placeholder="进度" />
      <select v-model="childStatus">
        <option value="pending">待开始</option>
        <option value="in-progress">进行中</option>
        <option value="completed">已完成</option>
        <option value="blocked">已阻塞</option>
      </select>
      <button class="btn-add" @click="confirmAddChild">添加</button>
      <button class="btn-cancel" @click="showAddForm = false">取消</button>
    </div>

    <div v-if="showEditForm" class="edit-form">
      <input v-model="editTitle" placeholder="节点名称" />
      <input v-model.number="editProgress" type="number" min="0" max="100" placeholder="进度" />
      <select v-model="editStatus">
        <option value="pending">待开始</option>
        <option value="in-progress">进行中</option>
        <option value="completed">已完成</option>
        <option value="blocked">已阻塞</option>
      </select>
      <button class="btn-save" @click="saveEdit">保存</button>
      <button @click="showEditForm = false">取消</button>
    </div>

    <div v-if="expanded && node.children?.length" class="node-children">
      <NodeItem
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :project-id="projectId"
        @add-child="(parentId, nodeData) => $emit('addChild', parentId, nodeData)"
        @delete="(nodeId) => $emit('delete', nodeId)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { ProjectNode } from '@/types'

const store = useProjectStore()
const props = defineProps<{ node: ProjectNode; projectId: string }>()
const emit = defineEmits<{
  (
    e: 'addChild',
    parentId: string,
    nodeData: Omit<ProjectNode, 'id' | 'createdAt' | 'updatedAt' | 'children' | 'attachments'>,
  ): void
  (e: 'delete', nodeId: string): void
}>()

const expanded = ref(false)
const showAddForm = ref(false)
const showEditForm = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editTitle = ref(props.node.title)
const editProgress = ref(props.node.progress)
const editStatus = ref<ProjectNode['status']>(props.node.status)
const childTitle = ref('')
const childProgress = ref(0)
const childStatus = ref<ProjectNode['status']>('pending')

function openEditForm() {
  editTitle.value = props.node.title
  editProgress.value = props.node.progress
  editStatus.value = props.node.status
  showEditForm.value = true
}

async function saveEdit() {
  if (!editTitle.value.trim()) {
    alert('请输入节点名称')
    return
  }
  await store.updateNode(props.projectId, props.node.id, {
    title: editTitle.value.trim(),
    progress: Number(editProgress.value) || 0,
    status: editStatus.value,
  })
  showEditForm.value = false
}

function triggerFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await store.addAttachment(props.projectId, props.node.id, file)
  input.value = ''
}

async function removeAttachment(attachmentId: string) {
  await store.removeAttachment(props.projectId, props.node.id, attachmentId)
}

function confirmAddChild() {
  if (!childTitle.value.trim()) {
    alert('请输入子节点名称')
    return
  }
  emit('addChild', props.node.id, {
    title: childTitle.value.trim(),
    description: '',
    progress: Number(childProgress.value) || 0,
    status: childStatus.value,
    files: [],
  })
  childTitle.value = ''
  childProgress.value = 0
  childStatus.value = 'pending'
  showAddForm.value = false
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '待处理',
    'in-progress': '进行中',
    completed: '已完成',
    blocked: '已阻塞',
  }
  return labels[status] || status
}
</script>

<style scoped>
.node-item {
  margin-bottom: var(--spacing-xs);
}
.node-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 6px 12px;
  background: var(--color-bg-hover);
  border-radius: var(--radius-sm);
  border-left: 3px solid var(--color-primary);
}
.expand-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  padding: 2px var(--spacing-xs);
}
.expand-btn:hover {
  color: var(--color-text);
}
.node-title {
  font-weight: 500;
}
.node-status {
  font-size: var(--font-size-xs);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  color: #fff;
}
.node-status.pending {
  background: var(--status-pending);
}
.node-status.in-progress {
  background: var(--status-in-progress);
}
.node-status.completed {
  background: var(--status-completed);
}
.node-status.blocked {
  background: var(--status-blocked);
}
.node-progress {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}
.node-actions {
  display: flex;
  gap: var(--spacing-xs);
  margin-left: auto;
}
.node-actions button,
.attachment-item .btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}
.node-actions button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.node-children {
  margin-left: 28px;
  margin-top: var(--spacing-sm);
}
.add-child-form,
.edit-form {
  margin-left: 28px;
  background: var(--color-bg-hover);
  padding: var(--spacing-sm) 12px;
  border-radius: var(--radius-sm);
  margin-top: var(--spacing-xs);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}
.add-child-form input,
.add-child-form select,
.edit-form input,
.edit-form select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
.add-child-form input[type='number'],
.edit-form input[type='number'] {
  width: 60px;
}
.add-child-form button,
.edit-form button {
  padding: var(--spacing-xs) 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.add-child-form .btn-add,
.edit-form .btn-save {
  background: var(--color-primary);
  color: #fff;
  border: none;
}
.add-child-form .btn-cancel {
  background: var(--color-divider);
  color: var(--color-text);
  border: none;
}
.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  align-items: center;
}
.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--color-bg-hover);
  padding: 4px 8px 4px 4px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
}
.attachment-thumb {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border-radius: var(--radius-sm);
}
.file-name {
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.attachment-item .btn-icon {
  font-size: var(--font-size-xs);
  padding: 0 4px;
}
.attachment-item .btn-icon:hover {
  color: var(--color-danger);
  background: transparent;
}
</style>
