import { openDB } from 'idb';
import { defineStore } from 'pinia';
import { ref } from 'vue';
import type { KnowledgeItem  } from '@/types';

// 1. 初始化 IndexedDB（数据库名、版本、存储对象名）
const dbPromise = openDB('knowledgeDB', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('items')) {
      db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
    }
  },
});

export const useKnowledgeStore = defineStore('knowledge', () => {
  // 状态：知识库列表（响应式数组）
    const items = ref<KnowledgeItem[]>([]);
     // 加载数据：从 IndexedDB 读取所有条目
     async function loadItems() {
        const db = await dbPromise;
        const all =await db.getAll('items');
        items.value = all ;
    }

    // 添加条目：向 IndexedDB 添加新条目
    async function addItem(item: Omit<KnowledgeItem, 'id'>) {
        const db = await dbPromise;
        const id = await db.add('items', item);
        // 添加成功后，重新加载列表（或者手动插入，这里用重新加载最简单）
        await loadItems(); // 添加后重新加载数据
    }

    // 删除条目：从 IndexedDB 删除指定条目
    async function deleteItem(id: number) {
        const db = await dbPromise;
        await db.delete('items', id);
        await loadItems(); // 删除后重新加载数据
    }

    //启动时自动加载数据
    loadItems();

    return { items, loadItems, addItem, deleteItem };
}); 