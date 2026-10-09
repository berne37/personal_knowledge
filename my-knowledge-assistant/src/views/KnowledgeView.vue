<template>
  <div>
    <!-- chats: 顶栏改版——标题/搜索/筛选/新建挤一行；总览挪成下方独立统计卡片 -->
    <div class="header">
      <h2>知识库</h2>
      <input v-model="searchKeyword" class="search-input" placeholder="搜索知识条目..." />
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
      <button class="btn btn-primary add-btn" @click="showAddModal = true">＋ 新建条目</button>
    </div>

    <!-- 总览统计卡片：大数字 + 分类计数 -->
    <div v-if="stats.total > 0" class="stats-card">
      <div class="stats-num">{{ stats.total }}</div>
      <div class="stats-meta">
        <div class="stats-title">共 {{ stats.total }} 个条目</div>
      </div>
    </div>

    <!-- 列表 -->
    <KnowledgeList
      :items="filteredItems"
      :expandedId="expandedId"
      @go-detail="goToDetail"
      @delete="handleDelete"
      @updated="store.loadItems"
    />

    <!-- chats: 弹窗外壳抽成 BaseModal 统一维护（遮罩/卡片/Esc 关闭），这里只留标题和表单 -->
    <BaseModal v-if="showAddModal" @close="showAddModal = false">
      <h3>添加知识库</h3>
      <KnowledgeForm @add="handleAdd" @cancel="showAddModal = false" />
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useKnowledgeStore } from '@/stores/knowledgeStore'
import type { KnowledgeItem } from '@/types'
import KnowledgeList from '@/components/KnowledgeList.vue'
import KnowledgeForm from '@/components/KnowledgeForm.vue'
import BaseModal from '@/components/BaseModal.vue'

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
/* chats: 顶栏改版——标题/搜索/筛选/新建一行，总览挪成下方独立统计卡片 */
.header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.header h2 {
  margin-right: var(--spacing-xs);
}

.search-input {
  flex: 0 1 260px;
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

/* chats: 筛选从分段控件改回独立 chip——每个按钮自带边框，
   选中项描蓝边 + 浅蓝底（跟截图一致），不再整组共用外框 */
.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.filter-btn {
  padding: 5px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}
.filter-btn:hover {
  color: var(--color-text);
  border-color: var(--color-text-light);
}
.filter-btn.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.add-btn {
  margin-left: auto;
}

/* ===== chats: 总览统计卡片 ===== */
.stats-card {
  display: flex;
  align-items: center;
  gap: var(--spacing-lg);
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

/* 注意 global.css 的 `* { font-weight: normal }`：数字和「共 N 个」的 600 必须显式写 */
.stats-num {
  font-size: 34px;
  font-weight: 600;
  line-height: 1.1;
  color: var(--color-text);
  padding-right: var(--spacing-lg);
  border-right: 1px solid var(--color-border-light);
}

.stats-title {
  font-size: var(--font-size-md);
  font-weight: 600;
  color: var(--color-text);
  margin-bottom: 2px;
}

.stats-legend {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* chats: 遮罩与卡片外壳样式已抽到 BaseModal，这里只保留页内自己的布局样式 */
</style>
