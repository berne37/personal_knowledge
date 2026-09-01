<template>
  <div>
    <h2>知识库管理</h2>
    <!-- 表单子组件：监听 add 事件 -->
     <KnowledgeForm @add="handleAdd" />
      <!-- 列表子组件：传入数据，监听 delete 事件 -->
       <KnowledgeList :items="store.items"
       :expandedId="expandedId"
       @go-to-Detail="goToDetail"
        @delete="handleDelete" />
  </div>
</template>

//KnowledgeView 作为“中间人”，不关心 UI 细节，只管理数据（Pinia）。
//子组件通过事件将数据传上来，父组件调用 store 方法处理。

<script setup lang="ts">
  import {ref} from 'vue';
  import {useKnowledgeStore } from '@/stores/knowledgeStore';
  import type { KnowledgeItem } from '@/types';
  import KnowledgeList from '@/components/KnowledgeList.vue';
  import KnowledgeForm from '@/components/KnowledgeForm.vue';
  import { useRouter } from 'vue-router'

  const store = useKnowledgeStore();
  const newDesc = ref(''); 
  
  // 表单数据（响应式）
  const newTitle = ref('');
  const newDescription = ref('');
  const newLevel = ref<'已学会' | '学习中' | '待学习'>('学习中');
  //记录当前展开的是哪个条目
  const expandedId = ref<number | null>(null)
  const router = useRouter()

  // 添加：接收子组件发来的数据，调用 store
async function handleAdd(formData: { 
  title: string; 
  description: string; 
  level: '已学会' | '学习中' | '待学习' 
}) {
  //增加技能名以及技能描述的非空二次校验
  if (!formData.title.trim()) {
    alert('技能名称不能为空');
    return;
  }
  await store.addItem({
  title: formData.title,
  description: formData.description || '',
  level: formData.level
})
}

// 删除：接收子组件发来的 id，调用 store
async function handleDelete(id: number) {
  if(confirm('确定删除吗？')) {
    await store.deleteItem(id);
  }
}

function goToDetail(item: KnowledgeItem) {
  // 跳转到详情页，传递 item 的 title
  router.push({ name: 'KnowledgeDetail', params: { id: item.title } });
}
</script>
