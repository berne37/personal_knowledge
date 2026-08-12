<template>
    <div class="add-form">
        <input v-model="title" placeholder="技能名称" />
        <input v-model="description" placeholder="简要描述"></input>
        <select v-model="level">
            <option value="已学会">已学会</option>
            <option value="学习中">学习中</option>
            <option value="待学习">待学习</option>
        </select>
        <button @click="handleSubmit">添加</button>
    </div>
</template>


//defineEmits 声明了一个名为 add 的事件，父组件可以用 @add 监听。
//点击“添加”时，把表单数据打包成对象，通过 emit('add', 数据) 
发送给父组件。
//数据流向：子组件 → 父组件（通过事件）。

<script setup lang="ts">
import { ref } from 'vue';
// ✨ 核心知识点：defineEmits（子组件向父组件发送事件）
const emit = defineEmits<{
  (e: 'add', payload: { title: string; description: string; 
    level: '已学会' | '学习中' | '待学习' }): void;
}>();

const title = ref('');
const description = ref('');
const level = ref<'已学会' | '学习中' | '待学习'>('学习中');

function handleSubmit() {
  if (!title.value.trim()) {
    alert('请输入技能名称');
    return;
  }
  emit('add', 
  { title: title.value,
    description:description.value || '无描述',
     level: level.value 
});

  // 清空表单
  title.value = '';
  description.value = '';
  level.value = '学习中';
}
</script>

<style scoped>
.add-form { display: flex; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
.add-form input, .add-form select { padding: 8px 12px; border: 1px solid #ccc; border-radius: 6px; }
.add-form button { padding: 8px 16px; background: #42b983; color: white; border: none; border-radius: 6px; cursor: pointer; }
</style>