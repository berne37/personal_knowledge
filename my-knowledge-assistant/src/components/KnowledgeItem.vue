<template>
  <li class="item-row">
    <!-- 显示模式 -->
    <template v-if="!isEditing">
      <div class="item-body">
        <div class="item-head">
          <strong class="item-title">{{ props.item.title }}</strong>
          <div class="item-meta">
            <span class="level" :class="props.item.level">{{ props.item.level }}</span>
            <!-- 修复：原来直接插值 createdAt，会显示 2026-08-12T10:30:00.000Z 这种原始 ISO 串，现在统一走 formatDate() 格式化 -->
            <span class="date">{{ formatDate(props.item.createdAt) }}</span>
          </div>
        </div>
        <!-- 修复：描述为空时由 UI 层显示占位文案，不再依赖数据库里存的 '无描述' 字面量（对应 KnowledgeForm.vue 的那处修复） -->
        <p class="desc">{{ props.item.description || '暂无描述' }}</p>
      </div>

      <div class="item-foot">
        <!-- chats: 卡片化改版——底部左侧显示资料/子条目数量，都为空时整段不渲染 -->
        <span v-if="statsText" class="item-stats">{{ statsText }}</span>
        <div class="item-actions">
          <!-- chats: 卡片化改版——编辑/删除退为淡色文字按钮，整张卡只保留「进入详情」一个实心按钮 -->
          <button class="btn-text" @click="startEdit">编辑</button>
          <button class="btn-text btn-text-danger" @click="handleDelete">删除</button>
          <button class="btn-detail" @click="handleGoDetail">进入详情</button>
        </div>
      </div>
    </template>

    <!-- 编辑模式 -->
    <template v-else>
      <div class="edit-row">
        <input v-model="editTitle" class="edit-input" placeholder="标题" />
        <input v-model="editDesc" class="edit-input" placeholder="描述" />
        <select v-model="editLevel" class="edit-select">
          <option value="已学会">已学会</option>
          <option value="学习中">学习中</option>
          <option value="待学习">待学习</option>
        </select>
      </div>
      <div class="item-foot">
        <div class="item-actions">
          <button class="btn-text" @click="cancelEdit">取消</button>
          <button class="btn-detail" @click="saveEdit">保存</button>
        </div>
      </div>
    </template>
  </li>
</template>

<script setup lang="ts">
import type { KnowledgeItem } from '@/types'
import { computed, ref } from 'vue'
import { useKnowledgeStore } from '@/stores/knowledgeStore'

const store = useKnowledgeStore()

const props = defineProps<{
  item: KnowledgeItem
}>()

const emit = defineEmits<{
  (e: 'delete', id: number): void
  (e: 'go-detail', item: KnowledgeItem): void
  (e: 'updated'): void
}>()

const isEditing = ref(false)
const editTitle = ref('')
const editDesc = ref('')
const editLevel = ref<'已学会' | '学习中' | '待学习'>('学习中')

// chats: 卡片化改版新增——卡片底部显示「N 份资料 · N 个子条目」，用来体现条目本身的丰富度。
// 两者都为 0 时返回空串，模板里 v-if 直接不渲染，避免每张卡都挂一句「暂无」的占位噪音。
// 用可选链 + ?? 兜底：旧数据里的 children / attachments 可能是 undefined（见 loadItems 里补 id 的历史逻辑）。
const statsText = computed(() => {
  const parts: string[] = []
  const attachmentCount = props.item.attachments?.length ?? 0
  const childCount = props.item.children?.length ?? 0
  if (attachmentCount > 0) parts.push(`${attachmentCount} 份资料`)
  if (childCount > 0) parts.push(`${childCount} 个子条目`)
  return parts.join(' · ')
})

function startEdit() {
  editTitle.value = props.item.title
  editDesc.value = props.item.description || ''
  editLevel.value = props.item.level
  isEditing.value = true
}

async function saveEdit() {
  if (!editTitle.value.trim()) {
    alert('标题不能为空')
    return
  }
  await store.updateItem(props.item.id!, {
    title: editTitle.value,
    description: editDesc.value,
    level: editLevel.value,
  })
  isEditing.value = false
  emit('updated')
}

function cancelEdit() {
  isEditing.value = false
}

function handleDelete() {
  emit('delete', props.item.id!)
}

function handleGoDetail() {
  emit('go-detail', props.item)
}

// 修复：列表页原先没有日期格式化函数，才会直接把 ISO 串渲染到页面上。
// TODO: 详情页 KnowledgeDetailView.vue 里有一份一模一样的 formatDate，
// 后续可以抽到 src/utils/date.ts 统一复用，避免两处各改各的。
function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
</script>

<style scoped>
/* chats: 卡片化改版——.item-row 从「表格行」（border-bottom 分隔）改为独立卡片：
   白底、圆角、完整边框、hover 抬升，让「这一整块是一个可点单元」在视觉上成立。 */
.item-row {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: box-shadow var(--transition-fast);
}
.item-row:hover {
  box-shadow: var(--shadow-md);
}

/* chats: 信息分层——标题独占一行放大加粗，描述下沉为次要色，一眼能分出主次 */
.item-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
}

/* 注意：global.css 里 `* { font-weight: normal }` 压掉了 strong 的默认加粗，
   所以标题的 600 必须显式声明，不能靠标签默认值 */
.item-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.desc {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
}

/* chats: 卡片底部动作区——一条细分割线分开「信息」与「操作」，
   justify-content: flex-end + stats 的 margin-right: auto 让动作永远贴右，左侧统计没内容时自然收缩 */
.item-foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
}

.item-stats {
  margin-right: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

.item-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

/* chats: 次级动作（编辑/删除）用淡色文字按钮，避免每行都出现绿/橙/红三个实心色块 */
.btn-text {
  padding: 0;
  background: none;
  border: none;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast);
}
.btn-text:hover {
  color: var(--color-primary);
}
.btn-text-danger:hover {
  color: var(--color-danger);
}

/* chats: 主动作（进入详情/保存）保持实心，整张卡只有它一个强调色 */
.btn-detail {
  padding: 6px 14px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.btn-detail:hover {
  background: var(--color-primary-hover);
}

.level {
  padding: 2px 10px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  color: #fff;
}
.level.已学会 {
  background: var(--color-success);
}
.level.学习中 {
  background: var(--color-warning);
}
.level.待学习 {
  background: var(--color-danger);
}

.date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

/* ===== 编辑模式 ===== */
.edit-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.edit-input {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  font-family: inherit;
  min-width: 140px;
  flex: 1;
}
.edit-input:focus {
  border-color: var(--color-primary);
  outline: none;
}
.edit-select {
  padding: 6px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  background: var(--color-bg-white);
}
</style>
