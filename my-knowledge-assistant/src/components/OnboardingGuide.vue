<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue'

// ============================================================
// 新用户引导组件
// 两阶段：① 首次访问弹「欢迎卡」介绍产品；② 点「开始引导」走「聚光灯 tour」
// 用 localStorage 记是否已看过，看过就不再自动弹（侧边栏按钮可随时重看）
// ============================================================

// 引导步骤：每一步对应侧边栏里一个模块入口（用 data-tour 选择器定位）
interface TourStep {
  target: string // 目标元素选择器（带 data-tour 属性）
  title: string
  text: string
}

const STORAGE_KEY = 'my-knowledge-assistant:onboarding-done'

// 欢迎卡里展示的 6 个模块速览
const featureCards = [
  { glyph: '库', title: '知识库', desc: '上传已学会 / 学习中的技能资料，支持树形子条目' },
  { glyph: '聊', title: 'AI 对话', desc: '基于你的知识库问答，默认本地、按需联网' },
  { glyph: '图', title: '思维导图', desc: '依据知识库内容，一键生成知识结构导图' },
  { glyph: 'PDF', title: 'PDF 阅读', desc: '阅读 PDF 并提供第二图层划重点 / 记笔记' },
  { glyph: '项', title: '项目进度', desc: '新建项目、规划节点、记录进度与提醒' },
  { glyph: '设', title: '设置', desc: '配置你自己的 API Key、模型与接口地址' },
]

// tour 步骤与欢迎卡一一对应，顺序按侧边栏从上到下
const steps: TourStep[] = [
  {
    target: '[data-tour="knowledge"]',
    title: '知识库',
    text: '这里是你的「资料中心」。点「新建」上传一个技能或学习资料，可加子条目做树形拆分。',
  },
  {
    target: '[data-tour="chat"]',
    title: 'AI 对话',
    text: '向 AI 提问，回答默认只基于你的知识库（本地优先）。需要外部资料时再让它联网。',
  },
  {
    target: '[data-tour="mindmap"]',
    title: '思维导图',
    text: '选好知识库条目后，AI 会把它梳理成一张知识结构导图，帮你看清学习逻辑。',
  },
  {
    target: '[data-tour="pdf"]',
    title: 'PDF 阅读',
    text: '打开 PDF 后，用第二图层划重点、写笔记，所有标注都留在本地。',
  },
  {
    target: '[data-tour="projects"]',
    title: '项目进度',
    text: '把大任务拆成节点，每个节点记进度，避免学着学着就忘了做到哪。',
  },
  {
    target: '[data-tour="settings"]',
    title: '设置',
    text: '在这里填你自己的 API Key、模型名和接口地址——引导结束就能去配。',
  },
]

const showWelcome = ref(false)
const tourActive = ref(false)
const currentStep = ref(0)

// 聚光灯高亮框的位置与尺寸
const spotlight = ref({ top: 0, left: 0, width: 0, height: 0 })
// 提示气泡的位置（用 top/left 像素定位）
const tooltipPos = ref({ top: 0, left: 0 })
const tooltipRef = ref<HTMLElement | null>(null)

const spotlightStyle = computed(() => ({
  top: `${spotlight.value.top}px`,
  left: `${spotlight.value.left}px`,
  width: `${spotlight.value.width}px`,
  height: `${spotlight.value.height}px`,
}))

function hasSeen(): boolean {
  return localStorage.getItem(STORAGE_KEY) === '1'
}
function markSeen(): void {
  // 修复：用字符串 '1' 而非布尔值。localStorage 只存字符串，存 true 会变成 "true" 也能读，
  //    但统一约定成 '1' 更直观，避免后续判断里出现 === true 永远为 false 的坑
  localStorage.setItem(STORAGE_KEY, '1')
}

// 首次访问自动弹欢迎卡
onMounted(() => {
  if (!hasSeen()) showWelcome.value = true
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => window.removeEventListener('resize', onResize))

// 侧边栏「新手引导」按钮调用：随时重新打开欢迎卡
function openWelcome(): void {
  showWelcome.value = true
}

function startTour(): void {
  showWelcome.value = false
  tourActive.value = true
  currentStep.value = 0
  // 等下一帧 DOM 稳定再定位，避免拿到 0 尺寸（侧边栏可能还没渲染完）
  nextTick(() => positionStep())
}

function finishTour(): void {
  tourActive.value = false
  markSeen()
}

function skipTour(): void {
  // 跳过也标记为已看，避免每次进来都弹
  tourActive.value = false
  showWelcome.value = false
  markSeen()
}

// 核心：根据目标元素的位置，算出聚光灯框 + 气泡该放哪
function positionStep(): void {
  const step = steps[currentStep.value]
  if (!step) return
  const el = document.querySelector<HTMLElement>(step.target)
  if (!el) return

  const rect = el.getBoundingClientRect()
  const pad = 8 // 高亮框比目标大一圈，视觉更聚焦
  spotlight.value = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  }

  // 气泡位置要在「定位」之后量，因为它自己的尺寸会影响摆放
  nextTick(() => {
    const tip = tooltipRef.value
    const tipH = tip ? tip.offsetHeight : 160
    const tipW = tip ? tip.offsetWidth : 320
    const vw = window.innerWidth
    const vh = window.innerHeight

    // 优先放高亮框下方；底部放不下就翻到上方
    let top = rect.bottom + pad + 12
    if (top + tipH > vh - 12) {
      top = rect.top - pad - 12 - tipH
    }
    // 水平居中于目标，但夹在视口内，别超出右边
    let left = rect.left + rect.width / 2 - tipW / 2
    left = Math.max(12, Math.min(left, vw - tipW - 12))
    tooltipPos.value = { top, left }
  })
}

function next(): void {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    positionStep()
  } else {
    finishTour()
  }
}
function prev(): void {
  if (currentStep.value > 0) {
    currentStep.value--
    positionStep()
  }
}

function onResize(): void {
  if (tourActive.value) positionStep()
}

defineExpose({ openWelcome })
</script>

<template>
  <!-- ① 欢迎卡：首次访问出现 -->
  <div v-if="showWelcome" class="ob-mask">
    <div class="ob-welcome">
      <h2 class="ob-title">欢迎使用 个人知识助手</h2>
      <p class="ob-sub">一个本地优先（资料不上传云端）的私人学习工作台</p>

      <div class="ob-feature-grid">
        <div v-for="f in featureCards" :key="f.title" class="ob-feature">
          <span class="ob-glyph">{{ f.glyph }}</span>
          <div class="ob-feature-text">
            <div class="ob-feature-title">{{ f.title }}</div>
            <div class="ob-feature-desc">{{ f.desc }}</div>
          </div>
        </div>
      </div>

      <div class="ob-actions">
        <button class="ob-btn-text" @click="skipTour">跳过引导</button>
        <button class="ob-btn-primary" @click="startTour">开始引导</button>
      </div>
    </div>
  </div>

  <!-- ② 聚光灯 tour -->
  <div v-if="tourActive" class="ob-tour">
    <!-- 聚光灯：透明框 + 超大阴影「挖」出高亮区域，其余变暗 -->
    <div class="ob-spotlight" :style="spotlightStyle"></div>

    <!-- 提示气泡 -->
    <div
      ref="tooltipRef"
      class="ob-tooltip"
      :style="{ top: tooltipPos.top + 'px', left: tooltipPos.left + 'px' }"
    >
      <div class="ob-step-count">{{ currentStep + 1 }} / {{ steps.length }}</div>
      <h3 class="ob-tooltip-title">{{ steps[currentStep]?.title }}</h3>
      <p class="ob-tooltip-text">{{ steps[currentStep]?.text }}</p>
      <div class="ob-tooltip-actions">
        <button v-if="currentStep > 0" class="ob-btn-text" @click="prev">上一步</button>
        <button class="ob-btn-text" @click="skipTour">跳过</button>
        <button class="ob-btn-primary" @click="next">
          {{ currentStep === steps.length - 1 ? '完成' : '下一步' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 遮罩层：铺满全屏，挡住底层交互，只让气泡按钮可点 */
.ob-mask,
.ob-tour {
  position: fixed;
  inset: 0;
  z-index: 1000;
}
.ob-mask {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  animation: ob-fade 0.2s ease;
}

/* ---------- 欢迎卡 ---------- */
.ob-welcome {
  width: min(560px, 92vw);
  background: var(--color-bg-white);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xl);
  padding: var(--spacing-xl);
  animation: ob-pop 0.25s ease;
}
.ob-title {
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--color-text);
}
.ob-sub {
  margin: var(--spacing-xs) 0 var(--spacing-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}
.ob-feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}
.ob-feature {
  display: flex;
  gap: var(--spacing-sm);
  align-items: flex-start;
}
.ob-glyph {
  flex: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  background: var(--color-primary-light);
  color: var(--color-primary-dark);
  font-weight: 600;
  font-size: var(--font-size-sm);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ob-feature-title {
  font-weight: 500;
  color: var(--color-text);
}
.ob-feature-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}
.ob-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

/* ---------- 聚光灯 ---------- */
.ob-tour {
  /* 整层拦截点击，避免引导中误触底层 */
  pointer-events: auto;
}
.ob-spotlight {
  position: fixed;
  border-radius: var(--radius-md);
  border: 2px solid var(--color-primary);
  /* 超大阴影在四周铺一层暗色，中间「挖空」露出目标 */
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  pointer-events: none; /* 高亮框本身不挡点击，事件交给 .ob-tour */
  transition: all var(--transition-normal);
  animation: ob-pulse 1.6s ease-in-out infinite;
}

/* ---------- 提示气泡 ---------- */
.ob-tooltip {
  position: fixed;
  width: min(320px, 88vw);
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-md);
  pointer-events: auto;
  animation: ob-pop 0.2s ease;
}
.ob-step-count {
  font-size: var(--font-size-xs);
  color: var(--color-text-placeholder);
  margin-bottom: var(--spacing-xs);
}
.ob-tooltip-title {
  margin: 0 0 var(--spacing-xs);
  font-size: var(--font-size-lg);
  color: var(--color-text);
}
.ob-tooltip-text {
  margin: 0 0 var(--spacing-md);
  font-size: var(--font-size-md);
  color: var(--color-text-secondary);
  line-height: 1.6;
}
.ob-tooltip-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  justify-content: flex-end;
}

/* ---------- 按钮（复用设计令牌，和全局风格一致） ---------- */
.ob-btn-primary {
  border: none;
  background: var(--color-primary);
  color: #fff;
  padding: 8px 18px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}
.ob-btn-primary:hover {
  background: var(--color-primary-hover);
}
.ob-btn-text {
  border: none;
  background: transparent;
  color: var(--color-text-secondary);
  padding: 8px 10px;
  font-size: var(--font-size-md);
  cursor: pointer;
  border-radius: var(--radius-md);
}
.ob-btn-text:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* ---------- 动画 ---------- */
@keyframes ob-fade {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
@keyframes ob-pop {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
@keyframes ob-pulse {
  0%,
  100% {
    border-color: var(--color-primary);
  }
  50% {
    border-color: var(--color-primary-hover);
  }
}
</style>
