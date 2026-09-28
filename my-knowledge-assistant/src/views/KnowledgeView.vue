<template>
  <div>
    <div class="header">
      <!-- chats: 总览放进标题行——标题和总览是一组「页面是什么 + 现在有多少」的信息，
           添加按钮留在最右，左右分组用 space-between 拉开 -->
      <div class="header-left">
        <h2>知识库管理</h2>
        <div v-if="stats.total > 0" class="overview">
          <div class="ov-total">
            <span class="ov-num">{{ stats.total }}</span>
            <span class="ov-label">条目总数</span>
          </div>
          <div class="ov-right">
            <div class="ov-bar">
              <span v-if="stats.done" class="seg seg-done" :style="{ width: ratios.done }"></span>
              <span
                v-if="stats.learning"
                class="seg seg-learning"
                :style="{ width: ratios.learning }"
              ></span>
              <span v-if="stats.todo" class="seg seg-todo" :style="{ width: ratios.todo }"></span>
            </div>
            <div class="ov-legend">
              <span class="ov-lg">
                <span class="dot dot-done"></span>已学会 <b>{{ stats.done }}</b>
              </span>
              <span class="ov-lg">
                <span class="dot dot-learning"></span>学习中 <b>{{ stats.learning }}</b>
              </span>
              <span class="ov-lg">
                <span class="dot dot-todo"></span>待学习 <b>{{ stats.todo }}</b>
              </span>
            </div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" @click="showAddModal = true">＋ 添加知识库</button>
    </div>

    <!-- 搜索 + 筛选栏 -->
    <div class="toolbar">
      <input v-model="searchKeyword" class="search-input" placeholder="搜索知识库..." />
      <div class="filter-group">
        <button
          v-for="opt in filterOptions"
          :key="opt.label"
          class="filter-btn"
          :class="{ active: filterLevel === opt.value }"
          @click="filterLevel = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
      <span class="result-count">共 {{ filteredItems.length }} 条</span>
    </div>

    <!-- 列表 -->
    <KnowledgeList
      :items="filteredItems"
      :expandedId="expandedId"
      @go-detail="goToDetail"
      @delete="handleDelete"
      @updated="store.loadItems"
    />

    <!-- 添加知识库弹窗 -->
    <div v-if="showAddModal" class="modal-overlay" @click.self="showAddModal = false">
      <div class="modal">
        <h3>添加知识库</h3>
        <KnowledgeForm @add="handleAdd" @cancel="showAddModal = false" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { KnowledgeItem } from '@/types'
import KnowledgeList from '@/components/KnowledgeList.vue'
import KnowledgeForm from '@/components/KnowledgeForm.vue'

const store = useKnowledgeStore()
const router = useRouter()

// 弹窗控制
const showAddModal = ref(false)

// 搜索关键词
const searchKeyword = ref('')

// 筛选等级
const filterLevel = ref<string | null>(null)

const filterOptions = [
  { label: '全部', value: null },
  { label: '已学会', value: '已学会' },
  { label: '学习中', value: '学习中' },
  { label: '待学习', value: '待学习' },
]

// 展开控制
const expandedId = ref<number | null>(null)

// chats: 列表页总览用——统计各学习状态的条目数。
// 注意统计的是 store.items（全部条目），不是 filteredItems，否则一搜索数字就跟着变，就不叫「全局」了。
const stats = computed(() => {
  const all = store.items
  const countBy = (level: KnowledgeItem['level']) =>
    all.filter((item) => item.level === level).length
  return {
    total: all.length,
    done: countBy('已学会'),
    learning: countBy('学习中'),
    todo: countBy('待学习'),
  }
})

// 堆叠比例条的宽度百分比。total 为 0 时用 1 兜底，避免除零得到 NaN%（外层 v-if 已挡住这种情况，这里只是防御）
const ratios = computed(() => {
  const total = stats.value.total || 1
  return {
    done: `${(stats.value.done / total) * 100}%`,
    learning: `${(stats.value.learning / total) * 100}%`,
    todo: `${(stats.value.todo / total) * 100}%`,
  }
})

// 过滤后的列表
const filteredItems = computed(() => {
  let items = store.items

  if (filterLevel.value) {
    items = items.filter((item) => item.level === filterLevel.value)
  }

  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.trim().toLowerCase()
    items = items.filter((item) => item.title.toLowerCase().includes(keyword))
  }

  return items
})

// 添加
async function handleAdd(formData: {
  title: string
  description: string
  level: '已学会' | '学习中' | '待学习'
}) {
  if (!formData.title.trim()) {
    alert('技能名称不能为空')
    return
  }
  await store.addItem({
    title: formData.title,
    description: formData.description || '',
    level: formData.level,
  })
  showAddModal.value = false
}

// 删除
async function handleDelete(id: number) {
  if (confirm('确定删除吗？')) {
    await store.deleteItem(id)
  }
}

// 跳转详情
function goToDetail(item: KnowledgeItem) {
  // 改用 id 跳转（原来用 title，同名条目会跳错）
  router.push({ name: 'KnowledgeDetail', params: { id: String(item.id) } })
}
</script>

<style scoped>
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md);
  background: var(--color-bg);
  border-radius: var(--radius-md);
}

.search-input {
  flex: 1;
  min-width: 180px;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  background: var(--color-bg-white);
}
.search-input:focus {
  border-color: var(--color-primary);
  outline: none;
}

/* chats: 卡片化改版——4 个筛选按钮原先各自带边框，与搜索框挨在一起时「框太多」。
   改成分段控件（segmented control）：整组共用一个外框，只有选中项有实心底色。 */
.filter-group {
  display: flex;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}

.filter-btn {
  padding: 4px 14px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}
.filter-btn:hover {
  color: var(--color-text);
}
.filter-btn.active {
  background: var(--color-primary);
  color: #fff;
}

.result-count {
  font-size: var(--font-size-sm);
  color: var(--color-text-placeholder);
  margin-left: auto;
}

/* ===== chats: 列表页总览 ===== */
/* inline-flex → 整块宽度由内容决定（不再撑满整行）。
   比例条的宽度从这里来：ov-right 没有 flex:1，宽度取「图例文字」的 max-content，
   条子写 width:100% 就正好等于图例那行的宽度。 */
/* chats: 标题 + 总览一组靠左，添加按钮靠右 */
.header-left {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md) var(--spacing-lg);
  /* 总览是 inline-flex 只占内容宽度，min-width:0 防止它在窄屏把右侧按钮挤出去 */
  min-width: 0;
}

.overview {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-lg);
  max-width: 100%;
  padding: 6px var(--spacing-md);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.ov-total {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  padding-right: var(--spacing-lg);
  border-right: 1px solid var(--color-border-light);
}

/* 注意 global.css 的 `* { font-weight: normal }`：大数字的 600 必须显式写。
   22px 而不是原来的 28px——挪进标题行后，数字不能比 h2 的标题还抢眼 */
.ov-num {
  font-size: 22px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--color-text);
}

.ov-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
}

.ov-right {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.ov-bar {
  display: flex;
  width: 100%;
  height: 8px;
  border-radius: var(--radius-full);
  overflow: hidden;
  background: var(--color-border-light);
}
.ov-bar .seg {
  display: block;
  height: 100%;
  transition: width var(--transition-normal);
}
.seg-done {
  background: var(--color-success);
}
.seg-learning {
  background: var(--color-warning);
}
/* 待学习用中性灰而不是 danger 红：红色在这样一条长色带上太刺眼，
   而且「还没开始学」不是错误状态，不值得用警示色 */
.seg-todo {
  background: var(--status-pending);
}

.ov-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-md);
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
}
.ov-lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.ov-lg b {
  font-weight: 600;
  color: var(--color-text);
}

.dot {
  width: 8px;
  height: 8px;
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
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  min-width: 400px;
  max-width: 90%;
  box-shadow: var(--shadow-xl);
}
.modal h3 {
  margin-top: 0;
  margin-bottom: var(--spacing-md);
}
</style>
