<template>
  <!-- chats: 单行列表改版——整张卡可点进详情（role/tabindex 保留键盘可达），
       右侧只留一个小箭头作为「可点」的暗示，不再放实心色块按钮 -->
  <li
    v-if="!isEditing"
    class="item-row"
    role="button"
    tabindex="0"
    @click="handleGoDetail"
    @keydown.enter.prevent="handleGoDetail"
  >
    <div class="item-main">
      <strong class="item-title">{{ props.item.title }}</strong>
      <div class="item-subline">
        <!-- 描述为空时由 UI 层显示占位文案，不再依赖数据库里存的 '无描述' 字面量 -->
        <span class="desc">{{ props.item.description || '暂无描述' }}</span>
        <template v-if="statsText">
          <span class="sep">·</span>
          <span class="item-stats">{{ statsText }}</span>
        </template>
      </div>
    </div>

    <div class="item-side">
      <!-- chats: 状态由「实心彩色药丸」降级为「小圆点 + 中性灰文字」——
           颜色只留在 6px 的点上，信息没丢，但整行不再有五颜六色的块 -->
      <span class="level">
        <span class="level-dot" :class="levelDotClass"></span>{{ props.item.level }}
      </span>
      <!-- 修复：原来直接插值 createdAt，会显示 2026-08-12T10:30:00.000Z 这种原始 ISO 串 -->
      <span class="date">{{ formatDate(props.item.createdAt) }}</span>
      <div class="item-actions">
        <button class="btn-text" @click.stop="startEdit">编辑</button>
        <button class="btn-text btn-text-danger" @click.stop="handleDelete">删除</button>
      </div>
      <ChevronRight class="item-chevron" :size="16" />
    </div>
  </li>

  <!-- 编辑模式 -->
  <li v-else class="item-row item-row-editing">
    <div class="edit-row">
      <input v-model="editTitle" class="edit-input" placeholder="标题" />
      <input v-model="editDesc" class="edit-input" placeholder="描述" />
      <select v-model="editLevel" class="edit-select">
        <option value="已学会">已学会</option>
        <option value="学习中">学习中</option>
        <option value="待学习">待学习</option>
      </select>
    </div>
    <div class="item-actions">
      <button class="btn-text" @click="cancelEdit">取消</button>
      <button class="btn-ghost" @click="saveEdit">保存</button>
    </div>
  </li>
</template>

<script setup lang="ts">
import type { KnowledgeItem } from '@/types'
import { computed, ref } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import { formatDate } from '@/utils/date'

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

// 卡片底部显示「N 份资料 · N 个子条目」，用来体现条目本身的丰富度。
// 两者都为 0 时返回空串，模板里 v-if 直接不渲染，避免每张卡都挂一句「暂无」的占位噪音。
// 用可选链 + ?? 兜底：旧数据里的 children / attachments 可能是 undefined。
const statsText = computed(() => {
  const parts: string[] = []
  const attachmentCount = props.item.attachments?.length ?? 0
  const childCount = props.item.children?.length ?? 0
  if (attachmentCount > 0) parts.push(`${attachmentCount} 份资料`)
  if (childCount > 0) parts.push(`${childCount} 个子条目`)
  return parts.join(' · ')
})

// 状态点颜色：待学习用中性灰而不是 red——「还没开始学」不是错误状态，
// 而且列表页总览的比例条里待学习也是灰的，两处保持一致才不会自相矛盾。
const levelDotClass = computed(() => {
  if (props.item.level === '已学会') return 'dot-done'
  if (props.item.level === '学习中') return 'dot-learning'
  return 'dot-todo'
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

// chats: formatDate 抽到 src/utils/date.ts 统一维护（原先这里和详情页各有一份一模一样的实现）
</script>

<style scoped>
/* chats: 单行列表改版——原来是「主信息段 + 分割线 + 操作段」的两层结构，
   描述和底部操作之间空出一大块，卡片自然被撑高。现在压成一行的 flex：
   左侧主信息（标题 + 描述/统计），右侧元信息与操作，全部垂直居中，高度减半。 */
.item-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  padding: 12px var(--spacing-lg);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}
.item-row:hover {
  border-color: var(--color-divider);
  box-shadow: var(--shadow-sm);
}
.item-row:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 1px;
}

/* min-width: 0 是关键：不加的话 flex 子项默认 min-width:auto，
   长描述不会省略号，而是把右侧的状态/操作挤出容器 */
.item-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

/* 注意：global.css 里 `* { font-weight: normal }` 压掉了 strong 的默认加粗，
   所以标题的 600 必须显式声明，不能靠标签默认值 */
.item-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text);
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-subline {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sep {
  color: var(--color-text-light);
  flex-shrink: 0;
}

.item-stats {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  white-space: nowrap;
  flex-shrink: 0;
}

.item-side {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
}

/* 状态：小圆点 + 中性文字，不再用实心彩色药丸 */
.level {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  white-space: nowrap;
}
.level-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot-done {
  background: var(--color-success);
}
.dot-learning {
  background: var(--color-warning);
}
.dot-todo {
  background: var(--status-pending);
}

.date {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  white-space: nowrap;
}

/* 操作区：一条淡竖线把它和元信息分开，按钮本身全部是中性文字色 */
.item-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding-left: var(--spacing-md);
  border-left: 1px solid var(--color-border-light);
}

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
  color: var(--color-text);
}
.btn-text-danger:hover {
  color: var(--color-danger);
}

/* 中性描边按钮：编辑模式下的「保存」用它，代替原来的绿色实心按钮 */
.btn-ghost {
  padding: 4px 12px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.btn-ghost:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-divider);
}

.item-chevron {
  color: var(--color-text-light);
  flex-shrink: 0;
  transition:
    color var(--transition-fast),
    transform var(--transition-fast);
}
.item-row:hover .item-chevron {
  color: var(--color-text-secondary);
  transform: translateX(2px);
}

/* ===== 编辑模式 ===== */
.item-row-editing {
  cursor: default;
}
.item-row-editing:hover {
  border-color: var(--color-border);
  box-shadow: none;
}

.edit-row {
  flex: 1;
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
