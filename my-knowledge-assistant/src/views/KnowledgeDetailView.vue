<template>
  <div class="detail-view">
    <!-- 加载中 -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- 条目不存在 -->
    <div v-else-if="!item" class="empty-state">
      <p>知识库不存在</p>
      <button @click="goBack">返回知识库</button>
    </div>

    <!-- 主内容 -->
    <div v-else class="detail-content">
      <!-- ===== 头部信息（支持编辑） ===== -->
      <div class="detail-header">
        <div class="header-top">
          <button class="back-btn" @click="goBack">← 返回</button>
          <div class="header-actions">
            <template v-if="!isEditing">
              <button class="btn-edit" @click="startEdit">编辑</button>
            </template>
            <template v-else>
              <button class="btn-save" @click="saveEdit">保存</button>
              <button class="btn-cancel" @click="cancelEdit">取消</button>
            </template>
          </div>
        </div>

        <!-- 显示模式 -->
        <template v-if="!isEditing">
          <h1 class="detail-title">{{ item.title }}</h1>
          <div class="detail-meta">
            <span class="level-badge" :class="item.level">{{ item.level }}</span>
            <span class="detail-date">创建于 {{ formatDate(item.createdAt) }}</span>
          </div>
          <p v-if="item.description" class="detail-desc">{{ item.description }}</p>
        </template>

        <!-- 编辑模式 -->
        <template v-else>
          <input v-model="editTitle" class="edit-title-input" placeholder="标题" />
          <div class="detail-meta">
            <select v-model="editLevel" class="edit-level-select">
              <option value="已学会">已学会</option>
              <option value="学习中">学习中</option>
              <option value="待学习">待学习</option>
            </select>
            <span class="detail-date">创建于 {{ formatDate(item.createdAt) }}</span>
          </div>
          <textarea
            v-model="editDesc"
            class="edit-desc-textarea"
            placeholder="描述（可选）"
            rows="3"
          ></textarea>
        </template>
      </div>

      <!-- ===== 导航栏 ===== -->
      <div class="tab-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="tab-btn"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- ===== Tab 内容面板 ===== -->
      <div class="tab-content">
        <!-- 文本 -->
        <div v-show="activeTab === 'text'" class="tab-panel">
          <!-- 只读模式 -->
          <div v-if="!isEditing" class="text-content">
            <p v-if="item.description">{{ item.description }}</p>
            <p v-else class="empty-text">暂无描述</p>
          </div>
          <!-- 编辑模式 -->
          <div v-else class="text-content edit-mode">
            <textarea
              v-model="editDesc"
              class="edit-textarea"
              rows="6"
              placeholder="输入知识库详细内容..."
            ></textarea>
          </div>
        </div>

        <!-- 附件 -->
        <div v-show="activeTab === 'attachments'" class="tab-panel">
          <div class="attachments-panel">
            <div class="upload-area">
              <button class="upload-btn" @click="triggerFilePicker">📎 上传附件</button>
              <!-- 🔧 修改：accept 加上 application/pdf，允许上传 PDF -->
              <input
                ref="fileInput"
                type="file"
                accept="image/*,application/pdf"
                style="display: none"
                @change="handleFileChange"
              />
              <span class="upload-hint">支持图片（JPG、PNG、GIF、WebP）和 PDF</span>
            </div>

            <div v-if="item.attachments && item.attachments.length > 0" class="attachment-list">
              <div v-for="att in item.attachments" :key="att.id" class="attachment-item">
                <img
                  v-if="att.type && att.type.startsWith('image/')"
                  :src="att.data"
                  class="attachment-preview"
                />
                <!-- 🔧 新增：非图片（如 PDF）显示占位图标，避免布局错位 -->
                <div v-else class="attachment-preview file-icon">PDF</div>
                <div class="attachment-info">
                  <span class="attachment-name">{{ att.name }}</span>
                  <span class="attachment-date">{{ formatDate(att.dateAdded) }}</span>
                </div>
                <!-- 🔧 新增：PDF 附件才显示「阅读」按钮，点了跳去 PDF 阅读器 -->
                <button
                  v-if="att.type === 'application/pdf'"
                  class="read-btn"
                  @click="handleReadPdf(att)"
                >阅读</button>
                <button class="delete-btn" @click="handleRemoveAttachment(att.id)">×</button>
              </div>
            </div>
            <div v-else class="empty-attachments">
              <p>暂无附件，点击上方按钮上传</p>
            </div>
          </div>
        </div>

        <!-- 子条目 -->
        <div v-show="activeTab === 'nodes'" class="tab-panel">
          <div class="nodes-panel">
            <div class="nodes-header">
              <button class="add-child-btn" @click="showAddChildForm = !showAddChildForm">
                {{ showAddChildForm ? '取消' : '+ 添加子条目' }}
              </button>
            </div>

            <div v-if="showAddChildForm" class="add-child-form">
              <input v-model="childTitle" placeholder="子条目名称" />
              <input v-model="childDesc" placeholder="描述（可选）" />
              <select v-model="childLevel">
                <option value="已学会">已学会</option>
                <option value="学习中">学习中</option>
                <option value="待学习">待学习</option>
              </select>
              <button class="btn-confirm" @click="handleAddChild">添加</button>
              <button class="btn-cancel" @click="showAddChildForm = false">取消</button>
            </div>

            <div v-if="item.children && item.children.length > 0" class="children-list">
              <KnowledgeItemComponent
                v-for="child in item.children"
                :key="child.id"
                :item="child"
                @delete="loadItem"
                @go-detail="handleGoToChildDetail"
                @updated="loadItem"
              />
            </div>
            <div v-else class="empty-children">
              <p>暂无子条目，点击上方按钮添加</p>
            </div>
          </div>
        </div>

        <!-- 思维导图 -->
        <div v-show="activeTab === 'mindmap'" class="tab-panel">
          <div class="mindmap-panel">
            <div v-if="item.mindmapData" class="mindmap-container">
              <MindMap :data="item.mindmapData" />
              <div class="mindmap-actions">
                <button class="update-btn" @click="handleGenerateMindmap" :disabled="isGenerating">
                  {{ isGenerating ? '生成中...' : '更新思维导图' }}
                </button>
              </div>
            </div>
            <div v-else class="empty-mindmap">
              <p>暂无思维导图</p>
              <button class="generate-btn" @click="handleGenerateMindmap" :disabled="isGenerating">
                {{ isGenerating ? '生成中...' : '生成思维导图' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
// 🔧 新增：PDF 中转 store，用于把知识库的 PDF 附件送到 PDF 阅读器
import { usePDFStore } from '@/stores/PDFStore'
import type { Attachment, KnowledgeItem } from '@/types'
import KnowledgeItemComponent from '@/components/KnowledgeItem.vue'
import MindMap from '@/components/MindMap.vue'
import { generateMindMapWithAI } from '@/services/mindMap'

const fileInput = ref<HTMLInputElement | null>(null)
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()

const item = ref<KnowledgeItem | null>(null)
const loading = ref(true)

// ===== Tab 配置 =====
const tabs = [
  { key: 'text', label: '文本' },
  { key: 'attachments', label: '附件' },
  { key: 'nodes', label: '子条目' },
  { key: 'mindmap', label: '思维导图' },
]
const activeTab = ref('text')

// ===== 编辑模式 =====
const isEditing = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const editLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

function startEdit() {
  if (!item.value) return
  editTitle.value = item.value.title
  editDesc.value = item.value.description || ''
  editLevel.value = item.value.level
  isEditing.value = true
}

async function saveEdit() {
  if (!item.value) return
  if (!editTitle.value.trim()) {
    alert('标题不能为空')
    return
  }
  await store.updateItem(item.value.id!, {
    title: editTitle.value,
    description: editDesc.value,
    level: editLevel.value,
  })
  isEditing.value = false
  await loadItem()
}

function cancelEdit() {
  isEditing.value = false
}

// ===== 子条目表单 =====
const showAddChildForm = ref(false)
const childTitle = ref('')
const childDesc = ref('')
const childLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

// ===== 加载数据 =====
async function loadItem() {
  const title = route.params.title as string
  if (!title) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const found = store.findItemByTitle(title)
    item.value = found || null
  } catch (error) {
    console.error('加载知识库失败:', error)
    item.value = null
  } finally {
    loading.value = false
  }
}

function goBack() {
  router.push({ name: 'Knowledge' })
}

function handleGoToChildDetail(child: KnowledgeItem) {
  router.push({ name: 'KnowledgeDetail', params: { title: child.title } })
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}

// ===== 子条目操作 =====
async function handleAddChild() {
  if (!item.value) return
  if (!childTitle.value.trim()) {
    alert('请输入子条目名称')
    return
  }

  try {
    await store.addChildItem(item.value.id!, {
      title: childTitle.value,
      description: childDesc.value || '',
      level: childLevel.value,
    })
    childTitle.value = ''
    childDesc.value = ''
    childLevel.value = '学习中'
    showAddChildForm.value = false
    await loadItem()
  } catch (error) {
    console.error('添加子条目失败:', error)
    alert('添加失败，请重试')
  }
}

// ===== 附件操作 =====
function triggerFilePicker() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !item.value) return

  try {
    await store.addAttachment(item.value.id!, file)
    await loadItem()
    input.value = ''
  } catch (error) {
    console.error('上传失败:', error)
    alert('上传失败，请重试')
  }
}

// 🔧 新增：点击「阅读」——把附件的 Base64 数据放进中转 store，再跳去 PDF 阅读器
function handleReadPdf(att: Attachment) {
  const pdfStore = usePDFStore()
  pdfStore.open(att.data, att.name)
  router.push('/pdf')
}

async function handleRemoveAttachment(attachmentId: string) {
  if (!item.value) return
  if (!confirm('确定删除此附件吗？')) return

  try {
    await store.removeAttachment(item.value.id!, attachmentId)
    await loadItem()
  } catch (error) {
    console.error('删除失败:', error)
    alert('删除失败，请重试')
  }
}

// ===== 思维导图 =====
const isGenerating = ref(false)

async function handleGenerateMindmap() {
  if (!item.value) return

  const current = item.value

  isGenerating.value = true
  try {
    await generateMindMapWithAI(
      current,
      undefined,
      (data) => {
        store.updateItem(current.id!, { mindmapData: data })
        loadItem()
        isGenerating.value = false
      },
      (error) => {
        console.error('生成失败:', error)
        alert('生成思维导图失败，请重试')
        isGenerating.value = false
      },
    )
  } catch (error) {
    console.error('生成失败:', error)
    isGenerating.value = false
  }
}

onMounted(() => {
  loadItem()
})
</script>

<style scoped>
.detail-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--color-text-placeholder);
}

/* ===== 头部 ===== */
.detail-header {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
}

.back-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-primary);
  font-size: var(--font-size-md);
  padding: 0;
}
.back-btn:hover {
  text-decoration: underline;
}

.detail-title {
  font-size: var(--font-size-xl);
  margin: 0 0 var(--spacing-sm) 0;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.detail-desc {
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: var(--spacing-sm) 0 0 0;
}

.level-badge {
  font-size: var(--font-size-xs);
  padding: 2px 12px;
  border-radius: var(--radius-full);
  color: #fff;
}
.level-badge.已学会 {
  background: var(--color-success);
}
.level-badge.学习中 {
  background: var(--color-warning);
}
.level-badge.待学习 {
  background: var(--color-danger);
}

.detail-date {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}

/* ===== 编辑模式 ===== */
.btn-edit {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-warning);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.btn-edit:hover {
  background: #d68910;
}

.btn-save {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-success);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.btn-save:hover {
  background: #2ecc71;
}

.btn-cancel {
  padding: var(--spacing-xs) var(--spacing-md);
  background: var(--color-bg-hover);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.edit-title-input {
  width: 100%;
  font-size: var(--font-size-xl);
  font-weight: 600;
  padding: var(--spacing-sm) 0;
  border: none;
  border-bottom: 2px solid var(--color-primary);
  outline: none;
  background: transparent;
  margin: 0 0 var(--spacing-sm) 0;
}

.edit-level-select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-bg-white);
}

.edit-desc-textarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-family: inherit;
  resize: vertical;
  margin-top: var(--spacing-sm);
}
.edit-desc-textarea:focus {
  border-color: var(--color-primary);
  outline: none;
}

/* ===== Tab 导航 ===== */
.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
  margin-bottom: -2px;
}
.tab-btn:hover {
  color: var(--color-text);
}
.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 500;
}

.tab-content {
  min-height: 300px;
}
.tab-panel {
  padding: var(--spacing-md) 0;
}

/* ===== 文本 ===== */
.text-content {
  line-height: 1.8;
  color: var(--color-text);
}
.empty-text {
  color: var(--color-text-placeholder);
}

/* ===== 附件 ===== */
.attachments-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.upload-area {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-border);
}

.upload-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-md);
}
.upload-btn:hover {
  background: var(--color-primary-hover);
}

.upload-hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.attachment-preview {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.attachment-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.attachment-name {
  font-size: var(--font-size-sm);
  font-weight: 500;
}
.attachment-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

/* 🔧 新增：「阅读」按钮（只有 PDF 附件才显示） */
.read-btn {
  padding: 4px 12px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}
.read-btn:hover {
  background: var(--color-primary-hover);
}

/* 🔧 新增：非图片附件的占位图标 */
.attachment-preview.file-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg);
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

.delete-btn {
  background: none;
  border: none;
  font-size: 20px;
  color: var(--color-text-placeholder);
  cursor: pointer;
  padding: 0 8px;
}
.delete-btn:hover {
  color: var(--color-danger);
}

.empty-attachments {
  color: var(--color-text-placeholder);
  text-align: center;
  padding: var(--spacing-lg) 0;
}

/* ===== 子条目 ===== */
.nodes-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.nodes-header {
  display: flex;
  justify-content: flex-start;
}

.add-child-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-md);
}
.add-child-btn:hover {
  background: var(--color-primary-hover);
}

.add-child-form {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg);
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}
.add-child-form input,
.add-child-form select {
  padding: var(--spacing-sm) 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}
.add-child-form .btn-confirm {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.add-child-form .btn-confirm:hover {
  background: var(--color-primary-hover);
}
.add-child-form .btn-cancel {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.children-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}
.empty-children {
  color: var(--color-text-placeholder);
  text-align: center;
  padding: var(--spacing-lg) 0;
}

/* ===== 思维导图 ===== */
.mindmap-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}
.mindmap-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  min-height: 400px;
  background: var(--color-bg-white);
  padding: var(--spacing-md);
}
.mindmap-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  margin-top: var(--spacing-md);
}

.update-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-md);
}
.update-btn:hover {
  background: var(--color-primary-hover);
}
.update-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.empty-mindmap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl) 0;
  color: var(--color-text-placeholder);
  gap: var(--spacing-md);
}

.generate-btn {
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-lg);
}
.generate-btn:hover {
  background: var(--color-primary-hover);
}
.generate-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.edit-textarea {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-family: inherit;
  resize: vertical;
  line-height: 1.8;
  min-height: 150px;
}
.edit-textarea:focus {
  border-color: var(--color-primary);
  outline: none;
}
</style>
