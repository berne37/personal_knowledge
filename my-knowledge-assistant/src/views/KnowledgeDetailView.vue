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
      <!-- ===== 头部信息（只读，编辑挪到「知识」tab） ===== -->
      <div class="detail-header">
        <div class="header-top">
          <button class="back-btn" @click="goBack">← 返回{{ parentTitle ? ' ' + parentTitle : '知识库' }}</button>
        </div>
        <h1 class="detail-title">{{ item.title }}</h1>
        <div class="detail-meta">
          <span class="level-badge" :class="item.level">{{ item.level }}</span>
          <span class="detail-date">创建于 {{ formatDate(item.createdAt) }}</span>
        </div>
        <p v-if="item.description" class="detail-desc">{{ item.description }}</p>
      </div>

      <!-- ===== 导航栏（chats: 四 tab 重构为 概览 | 知识 | 关系 | 资料） ===== -->
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

        <!-- chat: 概览只保留学习摘要和下一步入口；标题、状态、简介已在导航上方展示，不再重复。 -->
        <div v-show="activeTab === 'overview'" class="tab-panel">
          <div class="overview-layout">
            <section class="overview-notes">
              <div class="overview-section-head">
                <h3 class="ov-title">知识笔记</h3>
                <button class="overview-link" @click="activeTab = 'knowledge'">查看全部</button>
              </div>
              <p v-if="item.notes" class="overview-note">{{ item.notes }}</p>
              <p v-else class="ov-empty">还没有笔记，去「知识」记录学习内容。</p>
            </section>

            <section class="overview-resources">
              <button class="overview-stat" @click="activeTab = 'materials'">
                <strong>{{ item.attachments?.length || 0 }}</strong>
                <span>份资料</span>
              </button>
            </section>

            <section class="overview-relations">
              <div class="overview-section-head">
                <h3 class="ov-title">知识关联</h3>
                <button class="overview-link" @click="activeTab = 'relations'">管理关联</button>
              </div>
              <div class="relation-summary">
                <div>
                  <span class="relation-label">前置知识</span>
                  <div class="ov-chips">
                    <span v-for="id in item.prerequisites || []" :key="id" class="ov-chip">{{ knowledgeTitle(id) }}</span>
                    <span v-if="!(item.prerequisites && item.prerequisites.length)" class="ov-empty">暂无</span>
                  </div>
                </div>
                <div>
                  <span class="relation-label">相关知识</span>
                  <div class="ov-chips">
                    <span v-for="id in item.relatedKnowledge || []" :key="id" class="ov-chip">{{ knowledgeTitle(id) }}</span>
                    <span v-if="!(item.relatedKnowledge && item.relatedKnowledge.length)" class="ov-empty">暂无</span>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <!-- chats: 知识 tab（笔记 + 编辑 + 子条目 + 思维导图） -->
        <div v-show="activeTab === 'knowledge'" class="tab-panel">
          <section class="kb-section">
            <div class="kb-section-head">
              <h3 class="kb-title">笔记与编辑</h3>
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

            <!-- 只读：显示「长笔记」notes -->
            <div v-if="!isEditing" class="text-content">
              <p v-if="item.notes">{{ item.notes }}</p>
              <p v-else class="empty-text">暂无笔记内容，点「编辑」开始记录</p>
            </div>

            <!-- 编辑：标题 / 状态 / 短描述 / 长笔记 一起改 -->
            <div v-else class="edit-form">
              <input v-model="editTitle" class="edit-title-input" placeholder="标题" />
              <div class="detail-meta">
                <select v-model="editLevel" class="edit-level-select">
                  <option value="已学会">已学会</option>
                  <option value="学习中">学习中</option>
                  <option value="待学习">待学习</option>
                </select>
              </div>
              <textarea
                v-model="editDesc"
                class="edit-desc-textarea"
                placeholder="描述（可选）"
                rows="3"
              ></textarea>
              <textarea
                v-model="editNotes"
                class="edit-textarea"
                rows="6"
                placeholder="详细笔记 / 学习心得..."
              ></textarea>
            </div>
          </section>

          <!-- chat: 详情页不再提供子条目的创建、展示或跳转入口，避免在单一知识条目内继续分叉。 -->

          <!-- 思维导图 -->
          <section class="kb-section">
            <div class="kb-section-head"><h3 class="kb-title">思维导图</h3></div>
            <div class="mindmap-panel">
              <div v-if="item.mindmapData" class="mindmap-container">
                <!-- chat: 导图容器由 MindMap 组件按实际内容尺寸撑开，完整显示不裁切 -->
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
          </section>
        </div>

        <!-- chats: 关系 tab（第一版手动关联，无 AI） -->
        <div v-show="activeTab === 'relations'" class="tab-panel">
          <div class="relation-block">
            <h3 class="rel-title">前置知识</h3>
            <div class="rel-list">
              <span v-for="id in prerequisites" :key="id" class="rel-chip">
                {{ knowledgeTitle(id) }}
                <button class="rel-remove" @click="removeRelation('prerequisites', id)">×</button>
              </span>
              <span v-if="prerequisites.length === 0" class="rel-empty">暂无</span>
            </div>
            <select v-model="prereqSelect" @change="addPrereq" class="rel-select">
              <option value="">+ 添加前置知识</option>
              <option v-for="k in otherKnowledgeItems" :key="k.id" :value="k.id">{{ k.title }}</option>
            </select>
          </div>

          <div class="relation-block">
            <h3 class="rel-title">相关知识</h3>
            <div class="rel-list">
              <span v-for="id in relatedKnowledge" :key="id" class="rel-chip">
                {{ knowledgeTitle(id) }}
                <button class="rel-remove" @click="removeRelation('relatedKnowledge', id)">×</button>
              </span>
              <span v-if="relatedKnowledge.length === 0" class="rel-empty">暂无</span>
            </div>
            <select v-model="relatedSelect" @change="addRelated" class="rel-select">
              <option value="">+ 添加相关知识</option>
              <option v-for="k in otherKnowledgeItems" :key="k.id" :value="k.id">{{ k.title }}</option>
            </select>
          </div>

          <div class="relation-block">
            <h3 class="rel-title">相关资料</h3>
            <div class="rel-list">
              <span v-for="text in relatedMaterials" :key="text" class="rel-chip">
                {{ text }}
                <button class="rel-remove" @click="removeRelation('relatedMaterials', text)">×</button>
              </span>
              <span v-if="relatedMaterials.length === 0" class="rel-empty">暂无</span>
            </div>
            <div class="rel-add">
              <input v-model="materialInput" class="rel-input" placeholder="输入资料标题 / 链接" @keyup.enter="addMaterial" />
              <button class="rel-add-btn" @click="addMaterial">添加</button>
            </div>
          </div>

          <div class="relation-block">
            <h3 class="rel-title">相关项目</h3>
            <div class="rel-list">
              <span v-for="id in relatedProjects" :key="id" class="rel-chip">
                {{ projectTitle(id) }}
                <button class="rel-remove" @click="removeRelation('relatedProjects', id)">×</button>
              </span>
              <span v-if="relatedProjects.length === 0" class="rel-empty">暂无</span>
            </div>
            <select v-model="projectSelect" @change="addProject" class="rel-select">
              <option value="">+ 添加相关项目</option>
              <option v-for="p in projectStore.projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>
        </div>

        <!-- chats: 资料 tab（原「附件」面板整体搬来） -->
        <div v-show="activeTab === 'materials'" class="tab-panel">
          <div class="attachments-panel">
            <div class="upload-area">
              <!-- 🔧 local-first：支持 FSAA 的浏览器优先用「只记句柄」方式，文件内容不进 IndexedDB -->
              <!-- chats: 修复本地优先按钮漏绑定的 @click（之前没绑定，点了没反应） -->
              <button v-if="supportsFsaa" class="upload-btn" @click="addViaHandle"> 添加本地文件（本地优先）</button>
              <!-- 🔧 兼容模式：Firefox 等不支持 FSAA 时，降级为把内容转 Base64 入库 -->
              <button class="upload-btn" @click="triggerFilePicker"> 上传附件（兼容）</button>
              <!-- 🔧 修改：accept 加上 application/pdf，允许上传 PDF -->
              <input
                ref="fileInput"
                type="file"
                accept="image/*,application/pdf"
                style="display: none"
                @change="handleFileChange"
              />
              <span class="upload-hint">
                支持图片（JPG、PNG、GIF、WebP）和 PDF；
                <template v-if="supportsFsaa">「本地优先」只记录文件位置、内容不出本机</template>
                <template v-else>当前浏览器不支持本地优先，已用兼容模式</template>
              </span>
            </div>

            <div v-if="item.attachments && item.attachments.length > 0" class="attachment-list">
              <div v-for="att in item.attachments" :key="att.id" class="attachment-item">
                <img
                  v-if="att.type && att.type.startsWith('image/')"
                  :src="(previewUrls[att.id] || att.data) || undefined"
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

      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
// 🔧 新增：PDF 中转 store，用于把知识库的 PDF 附件送到 PDF 阅读器
import { usePDFStore } from '@/stores/PDFStore'
// chats: 关系「相关项目」需要读项目列表
import { useProjectStore } from '@/stores/projectStore'
import type { Attachment, KnowledgeItem } from '@/types'
import MindMap from '@/components/MindMap.vue'
import { generateMindMapWithAI } from '@/services/mindMap'

const fileInput = ref<HTMLInputElement | null>(null)
const route = useRoute()
const router = useRouter()
const store = useKnowledgeStore()
// chats: 项目 store（相关项目下拉 + 反查标题）
const projectStore = useProjectStore()

const item = ref<KnowledgeItem | null>(null)
const loading = ref(true)

// 🔧 local-first：浏览器是否支持 File System Access API（Chrome/Edge 支持，Firefox 不支持）。
// 支持时走「只存文件句柄、不存内容」的本地优先模式；不支持时降级回 Base64（兼容模式）。
const supportsFsaa = typeof (window as any).showOpenFilePicker === 'function'

// 句柄附件（无 Base64）的图片预览地址，按 attachment.id 缓存；从句柄现读文件生成。
const previewUrls = ref<Record<string, string>>({})

// chats: 四 tab 重构
const tabs = [
  { key: 'overview', label: '概览' },
  { key: 'knowledge', label: '知识' },
  { key: 'relations', label: '关系' },
  { key: 'materials', label: '资料' },
]
const activeTab = ref('overview')

// ===== 编辑模式 =====
const isEditing = ref(false)
const editTitle = ref('')
const editDesc = ref('')   // 短描述（头部摘要）
const editNotes = ref('')  // 长笔记（知识标签页）
const editLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

function startEdit() {
  if (!item.value) return
  editTitle.value = item.value.title
  editDesc.value = item.value.description || ''
  editNotes.value = item.value.notes || ''
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
    notes: editNotes.value,
    level: editLevel.value,
  })
  isEditing.value = false
  await loadItem()
}

function cancelEdit() {
  isEditing.value = false
}

// ===== 关系（chats: 第一版手动关联，本地 ref 与 item 字段同步） =====
const prerequisites = ref<number[]>([])
const relatedKnowledge = ref<number[]>([])
const relatedMaterials = ref<string[]>([])
const relatedProjects = ref<string[]>([])
const prereqSelect = ref('')
const relatedSelect = ref('')
const projectSelect = ref('')
const materialInput = ref('')

// chats: 把知识库树铺平成数组，供「关系」下拉选择（子条目也能被选为前置 / 相关知识）
function flattenItems(items: KnowledgeItem[]): KnowledgeItem[] {
  const result: KnowledgeItem[] = []
  for (const it of items) {
    result.push(it)
    if (it.children?.length) result.push(...flattenItems(it.children))
  }
  return result
}

// chats: 下拉里排除自己（不能把条目关联到自己）
const otherKnowledgeItems = computed(() =>
  flattenItems(store.items).filter((k) => k.id !== item.value?.id)
)

// chats: 反查标题用于展示（删条目会产生幽灵关联，v1 先留 TODO 不处理）
function knowledgeTitle(id: number): string {
  return store.findItemById(id)?.title ?? `未知条目(#${id})`
}
function projectTitle(id: string): string {
  return projectStore.projects.find((p) => p.id === id)?.name ?? `未知项目(${id})`
}

function addPrereq() {
  const id = Number(prereqSelect.value)
  if (id) {
    if (!prerequisites.value.includes(id)) prerequisites.value.push(id)
    prereqSelect.value = ''
    persistRelations()
  }
}
function addRelated() {
  const id = Number(relatedSelect.value)
  if (id) {
    if (!relatedKnowledge.value.includes(id)) relatedKnowledge.value.push(id)
    relatedSelect.value = ''
    persistRelations()
  }
}
function addProject() {
  const id = projectSelect.value
  if (id) {
    if (!relatedProjects.value.includes(id)) relatedProjects.value.push(id)
    projectSelect.value = ''
    persistRelations()
  }
}
function addMaterial() {
  const text = materialInput.value.trim()
  if (text) {
    if (!relatedMaterials.value.includes(text)) relatedMaterials.value.push(text)
    materialInput.value = ''
    persistRelations()
  }
}
function removeRelation(
  kind: 'prerequisites' | 'relatedKnowledge' | 'relatedMaterials' | 'relatedProjects',
  id: number | string
) {
  if (kind === 'prerequisites') prerequisites.value = prerequisites.value.filter((x) => x !== id)
  else if (kind === 'relatedKnowledge') relatedKnowledge.value = relatedKnowledge.value.filter((x) => x !== id)
  else if (kind === 'relatedProjects') relatedProjects.value = relatedProjects.value.filter((x) => x !== id)
  else relatedMaterials.value = relatedMaterials.value.filter((x) => x !== id)
  persistRelations()
}
// chats: 把四个关系数组一次性写回（updateItem 只合并已传字段，不用加新 API）
async function persistRelations() {
  if (!item.value) return
  await store.updateItem(item.value.id!, {
    prerequisites: prerequisites.value,
    relatedKnowledge: relatedKnowledge.value,
    relatedMaterials: relatedMaterials.value,
    relatedProjects: relatedProjects.value,
  })
  await loadItem()
}

// ===== 加载数据 =====
async function loadItem() {
  // 🔧 路由参数是 id（字符串），要转成数字才能和数据库里的 id 比对
  const id = Number(route.params.id)
  if (!id || Number.isNaN(id)) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    // chats: 关键修复——始终 await 知识库数据加载完成再查找，不再用
    // `store.items.length === 0` 提前跳过。刷新详情页是全新会话，store 初始化加载
    // 与本次加载可能并发，跳过判断会让 findItemById 用半初始化数据而查不到，
    // 直接显示「知识库不存在」。loadItems 已做单飞，重复 await 不会重复读库。
    await store.loadItems()

    // chats: 主数据就绪后再查，找到才赋值；找不到单独处理（不进 catch，避免和异常混淆）
    const found = store.findItemById(id)
    if (!found) {
      console.warn('[loadItem] 未找到该条目', { id, itemsCount: store.items.length })
      item.value = null
      return
    }
    item.value = found

    // 🔧 修复：切换到另一个条目前先退出编辑态。
    // 否则上一个条目的标题/描述还留在编辑框里，一保存就写到新条目上了。
    isEditing.value = false

    // chats: 进入条目时把关系字段同步到本地 ref
    prerequisites.value = found.prerequisites ?? []
    relatedKnowledge.value = found.relatedKnowledge ?? []
    relatedMaterials.value = found.relatedMaterials ?? []
    relatedProjects.value = found.relatedProjects ?? []
  } catch (error) {
    // 只有「知识库数据本身加载失败」(如 IndexedDB 异常) 才判定为不存在
    console.error('[loadItem] 知识库数据加载失败:', error)
    item.value = null
  } finally {
    loading.value = false
  }

  // chats: 项目列表 / 图片预览属于「辅助数据」，失败不应让主内容变「知识库不存在」。
  // 原本这行直接 await 在 try 内，一旦 projectStore.loadProjects() 抛错（刷新时
  // projects 为空必然走到），catch 就会把 item 清空 → 这就是刷新报「不存在」的根因。
  try {
    if (projectStore.projects.length === 0) {
      await projectStore.loadProjects()
    }
    // 🔧 local-first：句柄附件的图片预览需从句柄重新读文件
    await resolvePreviews()
  } catch (error) {
    console.warn('[loadItem] 辅助数据加载失败（不影响主内容显示）:', error)
  }
}

// 🔧 当前条目的父条目（顶层条目为 null）。放在顶层，模板和 goBack 都能用。
//    computed = 数据变了自动重算，不用手动刷新。
const parentItem = computed(() => {
  if (!item.value) return null
  return store.findParentOfId(item.value.id!)
})

// 按钮上显示的父条目名，没有父就显示「知识库」
const parentTitle = computed(() => parentItem.value?.title || '')

function goBack() {
  // 子条目 → 回到它所属的父知识库；顶层条目 → 回列表
  if (parentItem.value) {
    router.push({ name: 'KnowledgeDetail', params: { id: String(parentItem.value.id) } })
  } else {
    router.push({ name: 'Knowledge' })
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
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

// 🔧 local-first：用 File System Access API 选文件，只把「文件句柄」存进 IndexedDB，
// 不存文件内容。重开时再向用户要一次授权、从句柄读回文件。Firefox 不支持时走上面的 Base64 兼容模式。
async function addViaHandle() {
  if (!item.value) return
  try {
    const handles = await (window as any).showOpenFilePicker({
      types: [{ description: '图片或 PDF', accept: { 'application/pdf': ['.pdf'], 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] } }],
    })
    const handle = handles[0]
    // 句柄是结构化克隆安全的对象，可直接存进 IndexedDB
    await store.addAttachmentByHandle(item.value.id!, handle)
    await loadItem()
  } catch (error: any) {
    // 用户按了取消（AbortError）就不打扰；其他错误才提示
    if (error?.name !== 'AbortError') {
      console.error('添加文件失败:', error)
      alert('添加文件失败，请重试')
    }
  }
}

// chats: 切换详情页 / 反复预览前先释放旧 Blob URL，避免越积越多
function revokePreviews() {
  Object.values(previewUrls.value).forEach((url) => {
    if (url.startsWith('blob:')) URL.revokeObjectURL(url)
  })
}

// 🔧 local-first：句柄附件（无 Base64）的图片预览，需要从句柄现读文件生成临时 URL。
// 图片用 URL.createObjectURL，PDF 不需要预览图（显示占位图标）。
async function resolvePreviews() {
  revokePreviews() // chats: 先释放旧的，再生成新的
  if (!item.value?.attachments) {
    previewUrls.value = {}
    return
  }
  const urls: Record<string, string> = {}
  for (const att of item.value.attachments) {
    if (att.handle && att.type?.startsWith('image/')) {
      try {
        const file = await att.handle.getFile()
        urls[att.id] = URL.createObjectURL(file)
      } catch {
        // 授权被拒或文件已移走：预览留空，不影响其他功能
      }
    }
  }
  previewUrls.value = urls
}

// 🔧 改动：阅读 PDF 时，有句柄就带句柄（local-first 模式，不依赖 Base64）；
// 没有句柄（兼容模式）才退回到 Base64 数据。
function handleReadPdf(att: Attachment) {
  const pdfStore = usePDFStore()
  // data 降级方案是可选的（本地优先模式可能没 Base64），没有就传空串
  pdfStore.open(att.data ?? '', att.name, att.handle)
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

// chats: 组件卸载时释放 Blob URL，防止内存泄漏
onUnmounted(() => {
  revokePreviews()
})

// 🔧 修复：「进入子条目」时 URL 变了、页面内容却不变的根因。
// /knowledge/A → /knowledge/B 是同一条路由规则，Vue Router 会**复用同一个组件实例**，
// 不会销毁重建，所以 onMounted 只会在第一次执行。没有这个 watch，
// router.push 之后 route.params.id 变了但数据不会重新加载。
watch(
  () => route.params.id,
  () => {
    loadItem()
    window.scrollTo({ top: 0 })  // 切换条目后回到顶部，否则停在上一页的滚动位置
  }
)
</script>

<style scoped>
.detail-view {
  max-width: 1100px;
  margin: 0 auto;
  /* chats: 修掉原来无效的 var(--spacing-)（变量名没写完，浏览器直接忽略），改为 var(--spacing-sm) 与侧栏对齐 */
  padding-top: var(--spacing-sm);
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

.edit-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

/* ===== Tab 导航 ===== */
.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--spacing-sm);
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
  padding: var(--spacing-xs) 0;
}

/* chat: 概览采用「笔记优先、资料与层级次之、关系最后」的三段结构，避免重复头部信息。 */
.overview-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
.overview-notes,
.overview-relations {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.overview-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.ov-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
  color: var(--color-text);
}
.ov-empty {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}
.overview-note {
  margin: 0;
  color: var(--color-text-secondary);
  line-height: 1.8;
  white-space: pre-wrap;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
  overflow: hidden;
}
.overview-link {
  padding: 0;
  color: var(--color-primary);
  background: none;
  border: none;
  font: inherit;
  font-size: var(--font-size-sm);
  cursor: pointer;
}
.overview-link:hover { text-decoration: underline; }
.overview-resources {
  display: grid;
  /* chat: 子条目入口删除后，资料入口占满该摘要行。 */
  grid-template-columns: minmax(0, 1fr);
  gap: var(--spacing-sm);
}
.overview-stat {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: var(--spacing-md);
  color: var(--color-text);
  text-align: left;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  cursor: pointer;
}
.overview-stat:hover { border-color: var(--color-primary); }
.overview-stat strong { font-size: var(--font-size-xl); line-height: 1; }
.overview-stat span { color: var(--color-text-secondary); font-size: var(--font-size-sm); }
.ov-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.ov-chip {
  padding: 4px 12px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
.ov-chip.link {
  cursor: pointer;
  color: var(--color-primary);
}
.ov-chip.link:hover {
  background: var(--color-bg-hover);
}
.relation-summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
}
.relation-summary > div { display: flex; flex-direction: column; gap: var(--spacing-xs); }
.relation-label { color: var(--color-text-secondary); font-size: var(--font-size-sm); }

/* chat: 导航下的概览内容在窄屏改为单列，保证摘要和关联标签可完整阅读。 */
@media (max-width: 640px) {
  .overview-resources,
  .relation-summary { grid-template-columns: 1fr; }
}

/* ===== 知识 ===== */
.kb-section {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 1px solid var(--color-border);
}
.kb-section:last-child {
  border-bottom: none;
}
.kb-section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}
.kb-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0;
}
.text-content {
  line-height: 1.8;
  color: var(--color-text);
}
.empty-text {
  color: var(--color-text-placeholder);
}

/* ===== 关系（chats）===== */
.relation-block {
  margin-bottom: var(--spacing-lg);
}
.rel-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  margin: 0 0 var(--spacing-sm) 0;
}
.rel-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}
.rel-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: var(--color-bg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
}
.rel-remove {
  background: none;
  border: none;
  color: var(--color-text-placeholder);
  cursor: pointer;
  font-size: 16px;
  padding: 0 2px;
  line-height: 1;
}
.rel-remove:hover {
  color: var(--color-danger);
}
.rel-empty {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
}
.rel-select {
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-bg-white);
  max-width: 320px;
}
.rel-add {
  display: flex;
  gap: var(--spacing-sm);
}
.rel-input {
  flex: 1;
  max-width: 320px;
  padding: var(--spacing-sm) 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
}
.rel-add-btn {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: var(--font-size-sm);
}
.rel-add-btn:hover {
  background: var(--color-primary-hover);
}

/* ===== 文本 ===== */
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

/* ===== 附件 / 资料 ===== */
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

/* ===== 思维导图 ===== */
/* chat: 去掉导图内层卡片，缩小展示高度，让它作为知识内容的辅助视图。 */
.mindmap-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
/* chat: 大导图在卡片内滚动查看；容器尺寸由内部 MindMap 按内容撑开（max-content），
   超出 max-height 的部分纵向滚动，超出宽度的部分横向滚动。 */
.mindmap-container {
  overflow: auto;
  max-height: 78vh;
  min-height: 0;
  background: transparent;
  padding: 0;
}
/* chat: 自适应导图允许按实际宽高向外展开，完整展示所有节点。 */
.mindmap-panel:has(.mindmap-wrapper) {
  width: max-content;
  min-width: 100%;
}
.mindmap-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: var(--spacing-sm);
  margin-top: var(--spacing-sm);
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
  padding: var(--spacing-lg) 0;
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
</style>
