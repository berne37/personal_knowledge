<template>
    <div class="add-form">
        <input v-model="title" placeholder="技能名称" />
        <input v-model="description" placeholder="简要描述"></input>
        <select v-model="level">
            <option value="已学会">已学会</option>
            <option value="学习中">学习中</option>
            <option value="待学习">待学习</option>
        </select>
        <button class="btn btn-primary" @click="handleSubmit">添加</button>
        <button class="btn btn-secondary" @click="emit('cancel')">取消</button>
    </div>
</template>


//defineEmits 声明了一个名为 add 的事件，父组件可以用 @add 监听。
//点击“添加”时，把表单数据打包成对象，通过 emit('add', 数据) 
发送给父组件。
//数据流向：子组件 → 父组件（通过事件）。

<script setup lang="ts">
import { ref } from 'vue';
import { showError } from '@/utils/toast';
// 核心知识点：defineEmits（子组件向父组件发送事件）
const emit = defineEmits<{
  (e: 'add', payload: { title: string; description: string; level: '已学会' | '学习中' | '待学习' }): void
  (e: 'cancel'): void
}>()

const title = ref('');
const description = ref('');
const level = ref<'已学会' | '学习中' | '待学习'>('学习中');

function handleSubmit() {
  if (!title.value.trim()) {
    showError('请输入技能名称');
    return;
  }
  emit('add', 
  { title: title.value,
    // 🔧 修复：原来空描述会被替换成字面量字符串 '无描述' 存进 IndexedDB。
    // 这属于「把 UI 文案写进数据层」——以后改个措辞就得迁移历史数据，还会污染搜索结果。
    // 正确做法：数据层存真实的空值，占位文案交给展示层（KnowledgeItem 里已改成
    // `item.description || '暂无描述'`）处理。
    // ⚠️ 注意：修复前创建、描述为空的旧数据里仍然存着 '无描述' 三个字，
    // 它们在页面上会照原样显示，需要的话可以手动改掉，或后续写个数据迁移清一遍。
    description: description.value.trim(),
     level: level.value 
});

  // 清空表单
  title.value = '';
  description.value = '';
  level.value = '学习中';
}
</script>

<style scoped>
.add-form { display: flex; gap: var(--spacing-sm); margin-bottom: var(--spacing-md); flex-wrap: wrap; }
.add-form input, .add-form select { padding: var(--spacing-sm) 12px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); }
.add-form button { padding: var(--spacing-sm) var(--spacing-md); background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-sm); cursor: pointer; }
</style>