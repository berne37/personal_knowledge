<template>
  <div class="project-view">
    <h2>项目进度管理</h2>
    <button class="btn-primary" @click="showCreateModel = true">+ 新建项目</button>
  </div>

  <!-- 创建项目弹窗 -->
  <div v-if="showCreateModel" class="modal-overlay" @click.self="showCreateModel = false">
    <div class="modal">
      <h3>新建项目</h3>
      <input v-model="newProjectName" placeholder="项目名称" />
      <textarea v-model="newProjectDesc" placeholder="项目描述可选" rows="3"></textarea>
      <input type="date" v-model="newProjectDeadline" />
      <div class="modal-actions">
        <button class="btn-primary" @click="handleCreateProject">创建</button>
        <button class="btn-secondary" @click="showCreateModel = false">取消</button>
      </div>
    </div>
  </div>

  <!-- 项目列表 -->
  <div v-if="store.projects.length === 0" class="empty-state">
    <p>暂无项目，点击「新建项目」开始</p>
  </div>

  <div v-else class="project-grid">
    <div v-for="project in store.projects" :key="project.id" class="project-card">
      <div class="card-header" @click="toggleExpand(project.id)">
        <div class="card-title">
          <h3>{{ project.name }}</h3>
          <span class="node-count">{{ project.nodes.length }} 个节点</span>
        </div>
        <div class="card-actions">
          <span class="progress-badge">{{ store.getProjectProgress(project) }}%</span>
          <button class="btn-icon" @click.stop="deleteProject(project.id)">删除</button>
          <button class="btn-icon expand-btn" @click.stop="toggleExpand(project.id)">
            {{ expandedId === project.id ? '▲' : '▼' }}
          </button>
        </div>
      </div>

      <!-- 进度条 -->
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: store.getProjectProgress(project) + '%' }"
        ></div>
      </div>

      <!-- 展开详情 -->
      <div v-if="expandedId === project.id" class="card-details">
        <p class="desc">{{ project.description || '无描述' }}</p>
        <p class="deadline" v-if="project.deadline">
          截止日期: {{ new Date(project.deadline).toLocaleDateString() }}
        </p>

        <!-- 节点列表 -->
        <div class="nodes-section">
          <div class="nodes-header">
            <h4>节点列表</h4>
            <button class="btn-small" @click="openAddNode(project.id)">+ 添加节点</button>
          </div>

          <!-- 添加节点表单 -->
          <div v-if="addingNodeProjectId === project.id" class="add-node-form">
            <input v-model="newNodeTitle" placeholder="节点名称" />
            <input v-model="newNodeProgress" type="number" min="0" max="100" placeholder="进度" />
            <select v-model="newNodeStatus">
              <option value="pending">待开始</option>
              <option value="in-progress">进行中</option>
              <option value="completed">已完成</option>
              <option value="blocked">已阻塞</option>
            </select>
            <div class="form-actions">
              <button @click="cancelAddNode">取消</button>
              <button class="btn-primary" @click="confirmAddNode">添加</button>
            </div>
          </div>

          <!-- 节点列表 -->
          <div v-if="project.nodes.length === 0" class="empty-nodes">
            <span>暂无节点，添加第一个任务吧</span>
          </div>
          <div v-else class="node-list">
            <!-- 新增：透传 projectId，供节点内附件/编辑调用 store -->
            <NodeItem
              v-for="node in project.nodes"
              :key="node.id"
              :node="node"
              :project-id="project.id"
              @add-child="
                (parentId, nodeData) => store.addChildNode(project.id, parentId, nodeData)
              "
              @delete="(nodeId) => deleteNode(project.id, nodeId)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
import type { ProjectNode } from '@/types'
import NodeItem from '@/components/NodeItem.vue'

const store = useProjectStore()

//UI状态
const expandedId = ref<string | null>(null)
const showCreateModel = ref(false)
const newProjectName = ref('')
const newProjectDesc = ref('')
const newProjectDeadline = ref('')

//添加节点
const addingNodeProjectId = ref<string | null>(null)
const newNodeTitle = ref('')
const newNodeProgress = ref(0)
const newNodeStatus = ref<'pending' | 'in-progress' | 'completed' | 'blocked'>('pending')

// 添加子节点时的父节点 ID
const addChildParentId = ref<string | null>(null)

// ---------- 节点操作 ----------
function openAddNode(projectId: string) {
  addingNodeProjectId.value = projectId
  addChildParentId.value = null // 确保重置
  newNodeTitle.value = ''
  newNodeProgress.value = 0
  newNodeStatus.value = 'pending'
}

function cancelAddNode() {
  addingNodeProjectId.value = null
  addChildParentId.value = null
}

async function confirmAddNode() {
  if (!addingNodeProjectId.value) return
  if (!newNodeTitle.value.trim()) {
    alert('请输入节点标题')
    return
  }

  const nodeData = {
    title: newNodeTitle.value,
    description: '',
    progress: Number(newNodeProgress.value) || 0,
    status: newNodeStatus.value,
    files: [],
    attachments: [],
    children: [],
  }

  // 只调用一次
  if (addChildParentId.value) {
    await store.addChildNode(addingNodeProjectId.value, addChildParentId.value, nodeData)
    addChildParentId.value = null
  } else {
    await store.addNode(addingNodeProjectId.value, nodeData)
  }

  cancelAddNode()
}

function openAddChildNode(projectId: string, parentId: string) {
  addingNodeProjectId.value = projectId
  addChildParentId.value = parentId
  newNodeTitle.value = ''
  newNodeProgress.value = 0
  newNodeStatus.value = 'pending'
}

// ---------- 项目操作 ----------
function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

async function handleCreateProject() {
  if (!newProjectName.value) {
    alert('请输入项目名称')
    return
  }
  await store.createProject({
    name: newProjectName.value,
    description: newProjectDesc.value,
    deadline: newProjectDeadline.value,
  })
  //重置表单
  newProjectName.value = ''
  newProjectDesc.value = ''
  newProjectDeadline.value = ''
  showCreateModel.value = false
}

async function deleteProject(id: string) {
  if (confirm('确定删除该项目吗？')) {
    await store.deleteProject(id)
  }
}

// 状态下拉菜单显示控制
const statusMenuId = ref<string | null>(null)

// 所有状态选项
const statusOptions = ['pending', 'in-progress', 'completed', 'blocked'] as const

// 切换菜单
function toggleStatusMenu(projectId: string, nodeId: string) {
  const id = `${projectId}-${nodeId}`
  statusMenuId.value = statusMenuId.value === id ? null : id
}

// 修改节点状态
async function changeNodeStatus(
  projectId: string,
  nodeId: string,
  newStatus: 'pending' | 'in-progress' | 'completed' | 'blocked',
) {
  await store.updateNode(projectId, nodeId, { status: newStatus })
  statusMenuId.value = null // 关闭菜单
}

async function deleteNode(projectId: string, nodeId: string) {
  if (confirm('确定删除该节点吗？')) {
    await store.deleteNode(projectId, nodeId)
  }
}

// ---------- 文件路径处理 ----------
function openFilePicker(projectId: string, nodeId: string) {
  const input = document.createElement('input')
  input.type = 'file'
  input.multiple = false
  input.accept = 'image/*' // 只接受图片（可改为 */* 允许所有文件）
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    // 调用新的 store 方法
    await store.addAttachment(projectId, nodeId, file)
  }
  input.click()
}

//删除附件
async function removeAttachment(projectId: string, nodeId: string, attachmentId: string) {
  if (confirm('确定删除此附件吗？')) {
    await store.removeAttachment(projectId, nodeId, attachmentId)
  }
}
// ---------- 辅助函数 ----------
function getStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '待处理',
    'in-progress': '进行中',
    completed: '已完成',
    blocked: '已阻塞',
  }
  return map[status] || status
}

//占位(后续实现编辑节点)
function editNode(projectId: string, nodeId: string) {
  alert(`编辑节点 ${nodeId} (项目 ${projectId}) 功能尚未实现`)
}

// ---------- 加载数据 ----------
onMounted(() => {
  store.loadProjects()
})
</script>

<style scoped>
.projects-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-md);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}

.btn-primary {
  padding: var(--spacing-sm) 20px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-md);
  margin-top: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}
.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-small {
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
}
.btn-small:hover {
  background: var(--color-primary-hover);
}

.btn-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}
.btn-icon:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.btn-icon.danger:hover {
  background: #fee;
  color: var(--color-danger);
}
.btn-icon.primary:hover {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.file-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.file-tag {
  background: var(--color-border);
  color: var(--color-text-secondary);
  padding: 0 var(--spacing-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  line-height: 20px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}
.modal {
  background: var(--color-bg-white);
  padding: var(--spacing-lg);
  border-radius: var(--radius-lg);
  min-width: 400px;
  max-width: 90%;
  box-shadow: var(--shadow-xl);
}
.modal input,
.modal textarea {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-sm);
  margin: var(--spacing-sm) 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: inherit;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}
.modal-actions button {
  padding: var(--spacing-xs) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  cursor: pointer;
}
.modal-actions .btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
}

.empty-state {
  text-align: center;
  color: var(--color-text-placeholder);
  padding: 60px 0;
  font-size: var(--font-size-lg);
}

.project-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--spacing-md);
}

.project-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  transition: box-shadow var(--transition-fast);
}
.project-card:hover {
  box-shadow: var(--shadow-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.card-title {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.card-title h3 {
  margin: 0;
  font-size: var(--font-size-lg);
}
.node-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
.card-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.progress-badge {
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
}
.expand-btn {
  font-size: 20px;
  font-weight: bold;
}

.progress-bar {
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-sm);
  margin: var(--spacing-sm) 0 var(--spacing-xs) 0;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width var(--transition-normal);
}

.card-details {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}
.desc {
  color: var(--color-text-secondary);
  margin: var(--spacing-xs) 0 var(--spacing-sm) 0;
}
.deadline {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  margin: 0 0 var(--spacing-sm) 0;
}

.nodes-section {
  margin-top: var(--spacing-sm);
}
.nodes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}
.nodes-header h4 {
  margin: 0;
  font-size: var(--font-size-md);
}

.add-node-form {
  background: var(--color-bg-hover);
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  margin-bottom: var(--spacing-sm);
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  align-items: center;
}
.add-node-form input,
.add-node-form select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
.add-node-form input[type='number'] {
  width: 60px;
}
.form-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-left: auto;
}
.form-actions button {
  padding: var(--spacing-xs) 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  cursor: pointer;
}
.form-actions .btn-primary {
  background: var(--color-primary);
  color: #fff;
  border: none;
}

.empty-nodes {
  color: var(--color-text-light);
  font-size: var(--font-size-sm);
}

.node-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.node-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}
.node-title {
  font-weight: 500;
}
.node-status {
  font-size: var(--font-size-xs);
  padding: 2px var(--spacing-sm);
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
.node-files {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
.node-actions {
  display: flex;
  gap: var(--spacing-xs);
}

/* 进度控制 */
.progress-control {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.progress-control input[type='range'] {
  width: 100px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--color-text-light);
  border-radius: 2px;
  outline: none;
}
.progress-control input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
}
.progress-control .progress-input {
  width: 50px;
  padding: 4px 6px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  text-align: center;
}

/* 状态下拉菜单 */
.node-status-dropdown {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: var(--font-size-xs);
  padding: 2px 10px 2px var(--spacing-sm);
  border-radius: var(--radius-full);
  color: #fff;
  cursor: pointer;
  user-select: none;
  transition: opacity var(--transition-fast);
}
.node-status-dropdown:hover {
  opacity: 0.8;
}
.node-status-dropdown.pending {
  background: var(--status-pending);
}
.node-status-dropdown.in-progress {
  background: var(--status-in-progress);
}
.node-status-dropdown.completed {
  background: var(--status-completed);
}
.node-status-dropdown.blocked {
  background: var(--status-blocked);
}

.dropdown-arrow {
  font-size: 8px;
  margin-left: 2px;
}

.status-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md);
  z-index: 100;
  min-width: 80px;
  overflow: hidden;
}
.status-option {
  padding: 6px 12px;
  font-size: var(--font-size-sm);
  color: #fff;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.status-option:hover {
  opacity: 0.8;
}
.status-option.pending {
  background: var(--status-pending);
}
.status-option.in-progress {
  background: var(--status-in-progress);
}
.status-option.completed {
  background: var(--status-completed);
}
.status-option.blocked {
  background: var(--status-blocked);
}
.status-option:not(:last-child) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
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
  color: var(--color-text-placeholder);
}
.attachment-item .btn-icon:hover {
  color: var(--color-danger);
  background: transparent;
}
</style>
