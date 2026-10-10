<template>
  <!-- chats: 2026-10-10 定稿——项目页保持修改前的朴素页头（无白底通栏），标题 + 新建按钮两端对齐 -->
  <div class="header">
    <h2>项目进度管理</h2>
    <button class="btn-primary" @click="showCreateModel = true">+ 新建项目</button>
  </div>

  <!-- chats: 创建项目弹窗——外壳换成 BaseModal 统一维护（遮罩/卡片/Esc 关闭），
       表单字段是项目自己的业务，留在本页 -->
  <BaseModal v-if="showCreateModel" @close="showCreateModel = false">
    <h3>新建项目</h3>
    <input v-model="newProjectName" placeholder="项目名称" />
    <textarea v-model="newProjectDesc" placeholder="项目描述可选" rows="3"></textarea>
    <input type="date" v-model="newProjectDeadline" />
    <div class="modal-actions">
      <button class="btn-primary" @click="handleCreateProject">创建</button>
      <button class="btn-secondary" @click="showCreateModel = false">取消</button>
    </div>
  </BaseModal>

  <!-- chats: 修改项目弹窗——外壳同 BaseModal，字段与新建一致（名称/描述/截止日期），
       打开时用当前项目回填，保存走 updateProject -->
  <BaseModal v-if="showEditModel" @close="showEditModel = false">
    <h3>修改项目</h3>
    <input v-model="editProjectName" placeholder="项目名称" />
    <textarea v-model="editProjectDesc" placeholder="项目描述可选" rows="3"></textarea>
    <input type="date" v-model="editProjectDeadline" />
    <div class="modal-actions">
      <button class="btn-primary" @click="handleUpdateProject">保存</button>
      <button class="btn-secondary" @click="showEditModel = false">取消</button>
    </div>
  </BaseModal>

  <!-- 项目列表 -->
  <div v-if="store.projects.length === 0" class="empty-state">
    <p>暂无项目，点击「新建项目」开始</p>
  </div>

  <div v-else class="project-grid">
    <div v-for="project in store.projects" :key="project.id" class="project-card">
      <div class="card-header" @click="toggleExpand(project.id)">
        <div class="card-title">
          <h3>{{ project.name }}</h3>
          <!-- chats: 描述从展开区挪到头部中段（2026-10-09 用户要求）——占据标题和右侧按钮之间的空白，超长省略，不把头部撑高 -->
          <p v-if="project.description" class="card-desc">{{ project.description }}</p>
          <span class="node-count">{{ project.nodes.length }} 个节点</span>
        </div>

        <!-- chats: 截止日期挨着简介但独立成元素（用户明确要求不同容器），
             从展开区挪上来，收起卡片也能看到 -->
        <span v-if="project.deadline" class="card-deadline">
          截止日期: {{ formatDate(project.deadline) }}
        </span>
        <div class="card-actions">
          <!-- chats: 逾期标签——截止日期过了自动变红显示天数，不再假装是普通日期 -->
          <span v-if="overdueDays(project)" class="overdue-badge">
            已逾期 {{ overdueDays(project) }} 天
          </span>
          <span class="progress-badge">{{ store.getProjectProgress(project) }}%</span>
          <!-- chats: 修改入口——改名/描述/截止日期共用一个弹窗，.stop 防止触发卡片展开 -->
          <button class="btn-icon" @click.stop="openEditProject(project)">修改</button>
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
        <!-- chats: 描述和截止日期都已挪到卡片头部，展开区只留关联知识和节点列表 -->

        <!-- chats: 项目↔知识库双向联动的反向半边——
             正向是知识详情页的「相关项目」声明（relatedProjects），反向在这里读取时
             全库现算：凡是把自己关联到本项目的知识条目都列出来，点 chip 跳知识详情。
             不在 projectStore 里再存一份知识 id，避免两套关联数据互相打架。 -->
        <div class="rel-knowledge-section">
          <!-- chats: 标题行改为「关联知识 + 知识库按钮」，布局对齐节点列表的 nodes-header。
               按钮点击展开下拉多选面板：勾选 = 把项目 id 写进条目的 relatedProjects（存储单向在知识侧）；
               「单击直接跳知识库」如何与下拉共存未定，暂未做跳转 -->
          <div class="rel-knowledge-header">
            <!-- chats: 原右上角的「知识库」小按钮删掉，展开/收起多选面板的功能
                 剪给「关联知识」标题本身（用户 2026-10-09 拍板）——
                 点标题开下拉，之前「跳转 vs 下拉怎么共存」的纠结就此收场 -->
            <h4 class="rel-knowledge-toggle" @click="togglePicker(project.id)">关联知识</h4>
          </div>
          <div v-if="relatedKnowledgeOf(project.id).length" class="rel-knowledge-chips">
            <RouterLink
              v-for="k in relatedKnowledgeOf(project.id)"
              :key="k.id"
              :to="`/knowledge/${k.id}`"
              class="rel-knowledge-chip"
              :title="`${k.title} 的详情页`"
            >
              {{ k.title }}
            </RouterLink>
          </div>
          <!-- chats: 多选下拉——数据源是全库扁平化列表，勾选状态实时反映 relatedProjects -->
          <div v-if="pickerProjectId === project.id" class="rel-knowledge-picker">
            <p v-if="flatKnowledge.length === 0" class="rel-picker-empty">
              知识库还是空的，先去知识库页添加条目
            </p>
            <label v-for="k in flatKnowledge" :key="k.id" class="rel-picker-row">
              <input
                type="checkbox"
                :checked="k.relatedProjects?.includes(project.id)"
                @change="toggleProjectLink(k, project.id)"
              />
              <span>{{ k.title }}</span>
            </label>
          </div>
        </div>

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
import { ref, computed, onMounted } from 'vue'
import { useProjectStore } from '@/stores/projectStore'
// chats: 反向联动——扫知识库找「声明了本项目」的条目
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { Project, ProjectNode, KnowledgeItem } from '@/types'
import NodeItem from '@/components/NodeItem.vue'
import BaseModal from '@/components/BaseModal.vue'
// chats: 截止日期格式化统一走 utils（原先模板里内联 toLocaleDateString，没兜底也不带 locale）
import { formatDate } from '@/utils/date'

const store = useProjectStore()
const knowledgeStore = useKnowledgeStore()

// chats: 反向联动读取——遍历全库（含子条目），收集把本项目声明为「相关项目」的知识条目。
// 声明只存在知识条目身上（relatedProjects），项目侧读取时现算，和详情页「依赖我的」同一思路：
// 单向存储 + 动态反查，条目删除后这里自动消失，不会有幽灵引用。
function relatedKnowledgeOf(projectId: string): Array<{ id: number; title: string }> {
  // chats: 子条目已下线，直接过滤一层列表
  return knowledgeStore.items
    .filter((node) => node.id != null && node.relatedProjects?.includes(projectId))
    .map((node) => ({ id: node.id!, title: node.title }))
}

// chats: 项目侧正向挂载知识——多选下拉的数据源（全库扁平化，含子条目）与勾选写入。
// 勾选 = 把项目 id 增/删进条目的 relatedProjects，经 knowledgeStore.updateItem 持久化；
// 存储仍是单向（知识条目持有声明），项目侧读取继续走 relatedKnowledgeOf 反查，
// 不在 projectStore 里存知识 id，两套数据打架的老问题不会出现。
// chats: 子条目已下线，多选下拉的数据源就是全库一层列表
const flatKnowledge = computed(() => knowledgeStore.items)

// 下拉面板按项目维度开关：展开哪个项目的面板，就只显示哪个项目的勾选状态
const pickerProjectId = ref<string | null>(null)
function togglePicker(projectId: string) {
  pickerProjectId.value = pickerProjectId.value === projectId ? null : projectId
}

async function toggleProjectLink(item: KnowledgeItem, projectId: string) {
  if (item.id == null) return // 防止误命中：没有 id 的条目无法持久化
  const current = item.relatedProjects ?? []
  const next = current.includes(projectId)
    ? current.filter((id) => id !== projectId)
    : [...current, projectId]
  await knowledgeStore.updateItem(item.id, { relatedProjects: next })
}

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

// ---------- 修改项目 ----------
// chats: 编辑状态独立一套 ref（不复用新建的），打开时用当前项目回填；
// 只暴露名称/描述/截止日期三个字段，节点内容在节点行里自己管
const showEditModel = ref(false)
const editProjectId = ref<string | null>(null)
const editProjectName = ref('')
const editProjectDesc = ref('')
const editProjectDeadline = ref('')

function openEditProject(project: Project) {
  editProjectId.value = project.id
  editProjectName.value = project.name
  // 🔧 description/deadline 在类型上是可选字段（string | undefined），
  // 回填给 string 类型的 v-model ref 时兜底成空串，否则 tsc 报 TS2322
  editProjectDesc.value = project.description ?? ''
  editProjectDeadline.value = project.deadline ?? ''
  showEditModel.value = true
}

async function handleUpdateProject() {
  if (!editProjectId.value) return
  if (!editProjectName.value.trim()) {
    alert('请输入项目名称')
    return
  }
  await store.updateProject(editProjectId.value, {
    name: editProjectName.value.trim(),
    description: editProjectDesc.value,
    deadline: editProjectDeadline.value,
  })
  showEditModel.value = false
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

// chats: 逾期标签——截止日期晚于今天就不算（当天23:59前都不算逾期），返回逾期天数；
// 未设截止日期或未逾期返回 null，模板里 v-if 掉。
// 用 date-only 比较（两边都归零到 0 点）避免时分秒干扰，86400000 = 一天的毫秒数。
function overdueDays(project: Project): number | null {
  if (!project.deadline) return null
  const deadline = new Date(project.deadline + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - deadline.getTime()) / 86400000)
  return diff > 0 ? diff : null
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
/* chats: 原 .projects-view（限宽 1100 + 居中 + 留白）已随空壳容器一起删除——
   它只包住过页头，列表从来没吃到过这些规则，留着只会误导 */

/* chats: 页头回到修改前的朴素样式（2026-10-10 定稿，无白底通栏）——两端对齐 + 标题下留白；
   按钮的 margin 归零，因为 .btn-primary 自带 margin-top，flex 对齐会被它顶歪 */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
}
.header .btn-primary {
  margin: 0;
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

/* chats: 遮罩与卡片外壳样式已抽到 BaseModal；input/textarea 和按钮组是本页表单自己的样式 */
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

/* chats: 头部改 gap 布局（2026-10-09 截止日期进头部后共 4 个子元素）：
   标题/描述/日期按内容靠左排，按钮组 margin-left:auto 吃掉剩余空间靠右 */
.card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
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
/* chats: 头部描述——不占 flex:1 了（会把截止日期推去贴着按钮），
   按内容收缩、超长省略，min-width:0 允许它被压缩让位 */
.card-desc {
  flex: 0 1 auto;
  min-width: 0;
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* chats: 截止日期——独立小字元素，与描述不同容器，不参与收缩 */
.card-deadline {
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  white-space: nowrap;
}
.node-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
.card-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-left: auto; /* 按钮组推到最右，标题/描述/日期按内容靠左 */
}
.progress-badge {
  background: var(--color-primary-light);
  color: var(--color-primary);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: 500;
}

/* chats: 逾期徽章——浅红底从 --color-danger 用 color-mix 调出来，不写死色值 */
.overdue-badge {
  background: color-mix(in srgb, var(--color-danger) 10%, #fff);
  color: var(--color-danger);
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
/* chats: .deadline 样式已随截止日期挪到头部改为 .card-deadline，展开区不再有日期 */

/* chats: 关联知识区（反向联动）——chip 样式与知识详情页的 rel-chip 同语言：
   浅底 + 细边 + 小圆角，可点击的用主色文字区分于纯展示。
   标题行复用节点列表的「标题左 + 按钮右」布局 */
.rel-knowledge-section {
  margin: 0 0 var(--spacing-md) 0;
}
.rel-knowledge-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-sm);
}
.rel-knowledge-header h4 {
  margin: 0;
  font-size: var(--font-size-md);
  font-weight: 600;
}
/* chats: 标题现在身兼开关，得让它看起来能点：hover 变主色 + 下划线 */
.rel-knowledge-toggle {
  cursor: pointer;
  transition: color var(--transition-fast);
}
.rel-knowledge-toggle:hover {
  color: var(--color-primary);
  text-decoration: underline;
}
/* chats: 多选下拉面板——跟在 chip 区下方展开，列表长时内部滚动，
   不把项目卡片撑到无限高 */
.rel-knowledge-picker {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs) 0;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  max-height: 220px;
  overflow-y: auto;
}
.rel-picker-empty {
  margin: 0;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}
.rel-picker-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.rel-picker-row:hover {
  background: var(--color-bg-hover);
}
.rel-knowledge-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
}
.rel-knowledge-chip {
  padding: 3px 10px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  color: var(--color-primary-dark);
  text-decoration: none;
  transition: all var(--transition-fast);
}
.rel-knowledge-chip:hover {
  border-color: var(--color-primary);
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
