/**
 * 日期格式化工具
 *
 * chats: 原先 formatDate 在 KnowledgeItem.vue 和 KnowledgeDetailView.vue 各有一份
 * 一模一样的实现（当时留了 TODO 说要抽取），收敛到此处统一维护，
 * 改格式只需动这一个文件。
 */

/** 把日期字符串/时间戳格式化成 zh-CN 短日期（如 2026/9/30）；空值返回空串，由调用方决定兜底展示 */
export function formatDate(dateStr: string | number | Date): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
