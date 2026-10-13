<template>
  <!-- chats: 项目节点关系图谱 · 3D 版（2026-10-13，用户要求改成 3D 模式）——
       引擎是 3d-force-graph（vasturiano 出品，Three.js/WebGL，力学布局），
       换掉的原因：relation-graph 只有 2D。数据仍是 ProjectNode.children 拍平，零改动。
       交互：拖拽旋转、滚轮缩放、右键平移；点节点看只读详情面板，编辑仍在列表视图 -->
  <div class="project-graph">
    <div v-if="flatNodes.length === 0" class="graph-empty">
      <span>还没有节点，先在列表视图添加</span>
    </div>
    <template v-else>
      <div ref="graphBoxRef" class="graph-box"></div>

      <!-- 点节点出的详情小面板（只读，编辑回列表） -->
      <div v-if="selectedNode" class="graph-detail">
        <div class="gd-head">
          <strong class="gd-title">{{ selectedNode.title }}</strong>
          <span class="node-status" :class="selectedNode.status">{{ statusLabel(selectedNode.status) }}</span>
          <button class="gd-close" title="关闭" @click="selectedId = null">×</button>
        </div>
        <p v-if="selectedNode.description" class="gd-desc">{{ selectedNode.description }}</p>
        <p class="gd-meta">进度 {{ selectedNode.progress }}% · 附件 {{ selectedNode.attachments.length }} 个</p>
        <p class="gd-hint">要编辑请切到「列表」视图</p>
      </div>
      <div v-else class="graph-tip">点节点看详情 · 拖拽旋转 · 滚轮缩放 · 右键平移</div>
    </template>
  </div>
</template>

<script setup lang="ts">
// chats: 引擎选型（2026-10-13）——3d-force-graph 是 GitHub 上 3D 力导向图的事实标准
// （three-forcegraph 内核 + d3-force-3d），类型声明齐全，Vue 外面套一层挂载/销毁即可。
// relation-graph 只有 2D，所以 3D 模式换引擎；数据拍平逻辑和详情面板沿用原设计
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import ForceGraph3D from '3d-force-graph'
import type { ForceGraph3DInstance, NodeObject } from '3d-force-graph'
import * as THREE from 'three'
// chats: 球上跟随的名字标签用 SpriteText（canvas 贴图精灵，3D 图谱标配搭档）
import SpriteText from 'three-spritetext'
import type { Project, ProjectNode } from '@/types'

const props = defineProps<{ project: Project }>()

// 虚拟根节点 = 项目本身：顶层可能有多个节点，都挂到它下面，树的起点才唯一
const ROOT_ID = '__project_root__'

// 状态色与 tokens 同值（--status-*），但 WebGL 读不了 CSS 变量，只能写字面量
const STATUS_COLOR = {
  pending: '#95a5a6',
  'in-progress': '#f39c12',
  completed: '#42b983',
  blocked: '#e74c3c',
} as const
// 与 --color-primary 同值，理由同上
const PRIMARY_COLOR = '#3b82f6'

const STATUS_LABEL = {
  pending: '待处理',
  'in-progress': '进行中',
  completed: '已完成',
  blocked: '已阻塞',
} as const

function statusLabel(status: ProjectNode['status']) {
  return STATUS_LABEL[status]
}

// 全量节点索引：颜色/大小/点击详情都按 id 查回 ProjectNode（不依赖 NodeObject 自带字段）
const nodeById = computed(() => {
  const map = new Map<string, ProjectNode>()
  const walk = (list: ProjectNode[]) => {
    for (const n of list) {
      map.set(n.id, n)
      if (n.children?.length) walk(n.children)
    }
  }
  walk(props.project.nodes)
  return map
})
const flatNodes = computed(() => [...nodeById.value.keys()])

// 拍平：children 树 → nodes + links（父子一条线）
const graphData = computed(() => {
  const nodes: Array<{ id: string; name: string }> = [{ id: ROOT_ID, name: props.project.name }]
  const links: Array<{ source: string; target: string }> = []
  const walk = (list: ProjectNode[], parentId: string) => {
    for (const n of list) {
      nodes.push({ id: n.id, name: n.title })
      links.push({ source: parentId, target: n.id })
      if (n.children?.length) walk(n.children, n.id)
    }
  }
  walk(props.project.nodes, ROOT_ID)
  return { nodes, links }
})

// ---------- 3D 渲染（命令式 API：挂载时创建，卸载时销毁） ----------
const graphBoxRef = ref<HTMLDivElement | null>(null)
let fg: ForceGraph3DInstance | null = null

// 悬停标签（HTML 字符串）：节点自己不画文字（3D 里画字要引 sprite 库，先靠悬停提示）
function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function nodeLabel(node: NodeObject) {
  const id = String(node.id)
  // 🔧 根节点不在 nodeById 索引里（它只收真实节点），之前会落到兜底分支
  // 把内部 id「__project_root__」亮给用户——悬停该显示项目名
  if (id === ROOT_ID) return escapeHtml(props.project.name)
  const n = nodeById.value.get(id)
  if (!n) return escapeHtml(id)
  return `<div style="padding:4px 8px;background:rgba(255,255,255,.9);border-radius:6px;color:#333;font-size:12px">
    ${escapeHtml(n.title)}<br/><b>${statusLabel(n.status)} · ${n.progress}%</b></div>`
}

// chats: 球体 + 跟随的节点名（2026-10-13 用户要求）——
// 自定义 nodeThreeObject 后，默认的 nodeColor/nodeVal 不再生效，颜色大小都在这里算。
// 名字用 SpriteText 挂在球正下方，是场景里的 3D 精灵，旋转缩放时永远跟着球走
function nodeThreeObject(node: NodeObject) {
  const id = String(node.id)
  const isRoot = id === ROOT_ID
  const n = nodeById.value.get(id)
  const radius = isRoot ? 10 : n ? 3 + n.progress / 30 : 3
  const color = isRoot ? PRIMARY_COLOR : n ? STATUS_COLOR[n.status] : '#95a5a6'
  const labelHeight = isRoot ? 5.5 : 3.2

  const group = new THREE.Group()
  group.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(radius, 18, 18),
      new THREE.MeshLambertMaterial({ color }),
    ),
  )

  // 🔧 之前这里写的 project.title——Project 类型里根本没有这个字段（叫 name），
  // 根节点标签文字一直是 undefined，渲染成空白胶囊（2026-10-13 截图反馈）
  const label = new SpriteText(n ? n.title : props.project.name, labelHeight, '#444')
  label.fontWeight = isRoot ? '700' : '500' // 项目名加粗，截图反馈里它是主角
  label.backgroundColor = 'rgba(255,255,255,0.78)' // 半透明白底，亮色场景下保证可读
  label.borderRadius = 1.5
  label.padding = 1
  // 精灵锚点在中心，往下挪「半径 + 半个字高」贴住球下缘
  label.position.set(0, -(radius + labelHeight * 0.75), 0)
  // 🔧 标签不参与拾取（2026-10-13 修「拖不动」）——标签四边形比球大得多，
  // 拖拽起点几乎总会命中某个标签 → 被当成拖节点而不是旋转视角，图就「拖不动」了；
  // raycast 置空后拾取只认球体，标签纯展示
  label.raycast = () => {}
  group.add(label)
  return group
}

const selectedId = ref<string | null>(null)
const selectedNode = computed(() => (selectedId.value ? nodeById.value.get(selectedId.value) : null))

function onNodeClick(node: NodeObject) {
  if (String(node.id) === ROOT_ID) return
  selectedId.value = String(node.id)
}

function handleResize() {
  if (!fg || !graphBoxRef.value) return
  fg.width(graphBoxRef.value.clientWidth)
  fg.height(graphBoxRef.value.clientHeight)
}

// chats: 初始化时机（2026-10-13 修「球不渲染/拖不动」）——
// 图谱容器在条件分支里：展开项目时若还没有节点，渲染的是空态、graphBoxRef 为 null，
// 只靠 onMounted 初始化会 early return，之后节点出现了引擎也永远起不来。
// 改成 watch 容器 ref：元素一出现就初始化，fg 非空防重复
function initGraph(el: HTMLDivElement) {
  if (fg) return
  // 背景色取 tokens 的 --color-bg：WebGL 读不了 CSS 变量，运行时取计算值对齐主题
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#f6f6f7'
  fg = ForceGraph3D()(el)
    .backgroundColor(bg)
    .showNavInfo(false) // 左下角默认导航提示，与页面风格不符，关掉
    .nodeLabel(nodeLabel) // 悬停浮签补状态/进度（球上标签只放名字，太长会糊）
    .nodeThreeObject(nodeThreeObject)
    .linkColor(() => '#c9c7bd')
    .linkOpacity(0.6)
    .onNodeClick(onNodeClick)
  handleResize()
  fg.graphData(graphData.value)
  // 等力学布局把节点撒开后再取景，40px 内边距
  setTimeout(() => fg?.zoomToFit(400, 40), 600)
  window.addEventListener('resize', handleResize)
}

watch(
  graphBoxRef,
  (el) => {
    if (el) initGraph(el)
  },
  { immediate: true },
)

// 节点数据变了（列表里增删改）→ 喂新数据重排，选中项清掉防悬空
watch(
  () => props.project.nodes,
  () => {
    selectedId.value = null
    if (!fg) return
    fg.graphData(graphData.value)
    setTimeout(() => fg?.zoomToFit(400, 40), 600)
  },
  { deep: true },
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  // 不调用销毁的话 WebGL 上下文和 requestAnimationFrame 循环会一直挂着，切几次页面就泄漏几个
  fg?._destructor()
  fg = null
})
</script>

<style scoped>
.project-graph {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}
.graph-box {
  height: 400px; /* 3D 需要点纵深，比 2D 版高一点 */
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg);
}
.graph-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 160px;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-sm);
}

.graph-detail {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
}
.gd-head {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.gd-title {
  font-weight: 600;
}
/* chats: NodeItem 的 .node-status 是 scoped 样式借不过来，这里按同一套 tokens 复刻一份 */
.gd-head .node-status {
  font-size: var(--font-size-xs);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  color: #fff;
}
.gd-head .node-status.pending {
  background: var(--status-pending);
}
.gd-head .node-status.in-progress {
  background: var(--status-in-progress);
}
.gd-head .node-status.completed {
  background: var(--status-completed);
}
.gd-head .node-status.blocked {
  background: var(--status-blocked);
}
.gd-close {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-md);
}
.gd-close:hover {
  color: var(--color-text);
}
.gd-desc {
  margin: var(--spacing-xs) 0 0;
  color: var(--color-text-secondary);
}
.gd-meta {
  margin: var(--spacing-xs) 0 0;
  color: var(--color-text-secondary);
}
.gd-hint {
  margin: var(--spacing-xs) 0 0;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
}
.graph-tip {
  color: var(--color-text-placeholder);
  font-size: var(--font-size-xs);
  text-align: center;
}
</style>
