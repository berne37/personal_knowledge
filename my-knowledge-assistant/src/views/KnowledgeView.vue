<template>
  <div>
    <h2>知识库管理</h2>
      <!-- 添加新技能表单 -->
       <div class="add-form">
           <input v-model="newTitle" placeholder="技能名称" />
           <input v-model="newDescription" placeholder="简要描述"></input>
           <select v-model="newLevel">
             <option value="已学会">已学会</option>
             <option value="学习中">学习中</option>
             <option value="待学习">待学习</option>
           </select>
           <button @click="handleAdd">添加</button>
       </div>

     <!-- 技能列表 -->
      <ul class="item-list">
        <li v-for="item in store.items" :key="item.id">
          <div class="item-info">
            <strong>{{ item.title }}</strong>
            <span class="desc">{{ item.description }}</span>
            <span class="level" :class="item.level">{{ item.level }}</span>
            <span class="date">{{ item.createdAt }}</span>
          </div>
          <button @click="handleDelete(item.id!)">删除</button>
        </li>
      </ul>
      <p v-if="store.items.length === 0">暂无技能，请添加。</p>
  </div>
</template>
<script setup lang="ts">
  // 这里可以写一些逻辑代码，比如数据获取、状态管理等
  import {ref} from 'vue';
  import {useKnowledgeStore } from '@/stores/knowledgeStore';
  import type { KnowledgeItem } from '@/types';
  const store = useKnowledgeStore();

  // 表单数据（响应式）
  const newTitle = ref('');
  const newDescription = ref('');
  const newLevel = ref<'已学会' | '学习中' | '待学习'>('学习中');


  //添加处理
async function handleAdd() {
  if(!newTitle.value.trim()) return alert('请输入技能名称');
   const newItem: Omit<KnowledgeItem, 'id'> = {
    title: newTitle.value,
    description: newDescription.value || '无描述',
    level: newLevel.value,
    createdAt: new Date().toISOString(),
  };
  await store.addItem(newItem);
  // 清空表单
  newTitle.value = '';
  newDescription.value = '';
  newLevel.value = '学习中';
}

// 删除处理
async function handleDelete(id: number) {
  if(confirm('确定删除吗？')) {
    await store.deleteItem(id);
  }
}
</script>

<style scoped>
.add-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}
.add-form input, .add-form select {
  padding: 8px 12px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.add-form button {
  padding: 8px 16px;
  background: #42b983;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.item-list {
  list-style: none;
  padding: 0;
}
.item-list li {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
}
.item-info {
  display: flex;
  gap: 16px;
  align-items: center;
}
.level {
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 12px;
  color: white;
}
.level.已学会 { background: #42b983; }
.level.学习中 { background: #f39c12; }
.level.待学习 { background: #e74c3c; }
.date {
  font-size: 12px;
  color: #999;
}
</style>


