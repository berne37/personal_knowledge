<template>
  <div>
    <div class="header">
      <h2>知识库管理</h2>
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
