<template>
  <div class="pdf-view">
    <h2>PDF阅读器</h2>

    <!-- 工具栏 -->
    <div
      class="toolbar"
      :style="{
        left: toolbarPosition.x + 'px',
        top: toolbarPosition.y + 'px',
      }"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <!-- 拖动手柄（显示一个图标） -->
      <label class="toolbar-drag-handle" title="拖动移动工具栏">☰</label>

      <label class="upload-btn">
        上传PDF文件
        <input type="file" accept="application/pdf" @change="handleFileUpload" />
      </label>
      <span class="divider">|</span>

      <!-- 缩放控制 -->
      <span class="divider">|</span>

      <button class="tool-btn" @click="zoomOut">−</button>
      <span class="zoom-display">{{ Math.round(scaleFactor * 100) }}%</span>
      <button class="tool-btn" @click="zoomIn">+</button>
      <button class="tool-btn" @click="resetZoom">⟲ 适应</button>
      <!-- 工具切换 -->
      <button class="tool-btn" :class="{ active: currentTool === 'hand' }" @click="setTool('hand')">
        ✋ 抓手
      </button>
      <button
        class="tool-btn"
        :class="{ active: currentTool === 'select' }"
        @click="setTool('select')"
      >
        🖱️ 选择
      </button>
      <button
        class="tool-btn"
        :class="{ active: currentTool === 'highlight' }"
        @click="setTool('highlight')"
      >
        🟡 高亮
      </button>
      <button
        class="tool-btn"
        :class="{ active: currentTool === 'underline' }"
        @click="setTool('underline')"
      >
        🔽 下划线
      </button>
      <button
        class="tool-btn"
        :class="{ active: currentTool === 'rectangle' }"
        @click="setTool('rectangle')"
      >
        ⬜ 矩形
      </button>

      <span class="divider">|</span>

      <button class="tool-btn" @click="clearAnnotations">清除标注</button>
      <button class="tool-btn" @click="saveAnnotations">保存</button>
      <button class="tool-btn" @click="loadAnnotations">加载</button>
    </div>

    <!-- 显示页数和翻页按钮 -->
    <div v-if="pdfUrl" class="page-controls">
      <button @click="prevPage" :disabled="currentPage <= 1">上一页</button>
      <span>第 {{ currentPage }} 页 / 共 {{ totalPages }} 页</span>
      <button @click="nextPage" :disabled="currentPage === totalPages">下一页</button>
    </div>

    <!-- PDF 渲染容器：没上传时不渲染这个带边框的空 box，只显示下方占位提示 -->
    <div v-if="pdfUrl" class="pdf-container" ref="containerRef">
      <div class="pdf-wrapper" ref="wrapperRef">
        <canvas ref="canvasRef"></canvas>
        <!-- 标注图层（透明 Canvas 覆盖在上层） -->
        <canvas
          ref="annotationCanvasRef"
          class="annotation-layer"
          @mousedown="onMouseDown"
          @mousemove="onMouseMove"
          @mouseup="onMouseUp"
          @mouseleave="onMouseUp"
        ></canvas>
      </div>
      <div v-if="isLoading" class="loading">⏳ 加载中...</div>
    </div>

    <!-- 未上传时的提示 -->
    <div v-if="!pdfUrl" class="placeholder">
      <p>点击上方按钮选择 PDF 文件</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// ref 用于保存普通响应式数据，shallowRef 用于保存不应被 Vue 深层代理的第三方实例。
import { nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
// 新增：PDF 中转 store，用来接收从知识库详情页传过来的 PDF
import { usePDFStore } from '@/stores/PDFStore'
// pdfjsLib 负责解析 PDF，worker 用于将解析工作放到独立线程中执行。
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// 使用 Vite 处理后的本地 Worker 文件，避免 PDF.js 主线程和 Worker 版本不一致。
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// ---------- 类型定义 ----------
interface Annotation {
  id: string
  type: 'highlight' | 'underline' | 'rectangle'
  page: number
  x: number // PDF 坐标系中的 x（0-1 百分比）
  y: number // PDF 坐标系中的 y（0-1 百分比）
  width: number // PDF 坐标系中的宽度（0-1 百分比）
  height: number // PDF 坐标系中的高度（0-1 百分比）
  color: string
}

// ---------- 状态 ----------
// 保存当前 PDF 的临时 URL，用于判断是否已经上传文件。
const pdfUrl = ref('')
// PDFDocumentProxy 内部包含私有字段，因此使用 shallowRef 避免被 Vue 深层代理。
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
// 当前页码、总页数和加载状态会直接影响模板显示。
const currentPage = ref(1)
const totalPages = ref(0)
const isLoading = ref(false)

// 这些 ref 用于获取模板中的 DOM 元素，只有组件挂载后才可能有实际值。
const canvasRef = ref<HTMLCanvasElement | null>(null)
const annotationCanvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)

// 平移偏移量（用于抓手工具）
const translateX = ref(0)
const translateY = ref(0)

// 拖拽临时变量
let dragStartX = 0
let dragStartY = 0
let dragStartTranslateX = 0
let dragStartTranslateY = 0

// 工具栏位置（默认右上角）
const toolbarPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })

onMounted(async () => {
  // 初始位置：右上角
  toolbarPosition.value = {
    x: window.innerWidth - 260, // 假设工具栏宽度约 240px
    y: 80,
  }

  // 从知识库详情页点「阅读」进来时，这里取到待打开的 PDF。
  // consume() 取走后会清空，下次直接进页面不会自动打开旧文件。
  const pdfStore = usePDFStore()
  const { url, handle } = pdfStore.consume()
  if (handle) {
    // FSAA：拿到的是文件句柄（没存内容），需请求读权限后用句柄重读文件
    try {
      // 当前 TS DOM 库里的 FileSystemFileHandle 类型缺 requestPermission 声明，这里按需 cast。
      // 运行时 Chrome/Edge 一定支持（FSAA 的前提）。
      const perm = await (handle as any).requestPermission({ mode: 'read' })
      if (perm === 'granted') {
        const file = await handle.getFile()
        const objUrl = URL.createObjectURL(file)
        pdfUrl.value = objUrl
        loadPDF(objUrl)
      } else {
        // 用户拒绝授权：不自动打开，提示即可
        alert('需要文件读取权限才能打开该 PDF，请在浏览器弹窗中允许。')
      }
    } catch (e) {
      alert('打开文件失败：' + (e instanceof Error ? e.message : String(e)))
    }
  } else if (url) {
    pdfUrl.value = url
    loadPDF(url)
  }
})

//在窗口 resize 时调整位置防止超出
function clampPosition() {
  const toolbarEl = document.querySelector('.toolbar') as HTMLElement
  if (!toolbarEl) return
  const rect = toolbarEl.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width - 10
  const maxY = window.innerHeight - rect.height - 10
  toolbarPosition.value = {
    x: Math.max(10, Math.min(toolbarPosition.value.x, maxX)),
    y: Math.max(10, Math.min(toolbarPosition.value.y, maxY)),
  }
}

window.addEventListener('resize', clampPosition)

function applyTranslate() {
  const wrapper = wrapperRef.value
  if (!wrapper) return
  wrapper.style.transform = `translate(${translateX.value}px, ${translateY.value}px)`
}

//添加拖拽事件处理函数
function startDrag(e: MouseEvent) {
  const target = e.target as HTMLElement
  // 只有点击工具栏的“拖动手柄”区域才触发拖动
  if (!target.closest('.toolbar-drag-handle')) return

  isDragging.value = true
  const rect = (e.target as HTMLElement).closest('.toolbar')!.getBoundingClientRect()
  if (rect) {
    dragOffset.value = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }
  e.preventDefault()
}

// 拖动中
function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  toolbarPosition.value = {
    x: e.clientX - dragOffset.value.x,
    y: e.clientY - dragOffset.value.y,
  }
}

// 结束拖动
function endDrag() {
  isDragging.value = false
}

// 当前工具
const currentTool = ref<'hand' | 'select' | 'highlight' | 'underline' | 'rectangle'>('hand')
const drawColor = ref('#ffeb3b')

// 缩放因子（1 = 100%，即自适应宽度）
const scaleFactor = ref(1)
const minScale = 0.1
const maxScale = 3.0

// 标注数据（按页码存储）
const annotations = ref<Map<number, Annotation[]>>(new Map())

// 绘图状态
let isDrawing = false
let startX = 0
let startY = 0
let currentAnnotation: Annotation | null = null

// 当前渲染的标注列表（用于显示）
const currentPageAnnotations = ref<Annotation[]>([])

// ---------- Worker 设置 ----------
// 已经在顶部设置

// ---------- 工具切换 ----------
function setTool(tool: 'hand' | 'select' | 'highlight' | 'underline' | 'rectangle') {
  // 保存当前工具，让模板和鼠标事件都能使用同一份状态。
  currentTool.value = tool
  const canvas = annotationCanvasRef.value
  if (!canvas) return

  if (tool === 'hand') {
    canvas.style.cursor = 'grab'
  } else if (tool === 'select') {
    canvas.style.cursor = 'default'
  } else {
    canvas.style.cursor = 'crosshair'
  }
}

//--------上传处理--------
async function handleFileUpload(event: Event) {
  const inpt = event.target as HTMLInputElement //获取上传的文件
  const file = inpt.files?.[0] //获取第一个文件
  if (!file) return //如果没有文件,直接返回

  // 浏览器不会直接把 File 对象作为字符串传给 PDF.js，需要先创建可访问的临时 URL。
  //把文件转成URL
  const url = URL.createObjectURL(file) //将文件对象转换为URL
  pdfUrl.value = url

  //加载PDF文档
  await loadPDF(url)
}

//--------加载PDF文档--------
async function loadPDF(url: string) {
  isLoading.value = true
  try {
    // getDocument 返回一个加载任务，promise 完成后才能安全访问 PDF 文档信息。
    //获取加载任务
    const loadingTask = pdfjsLib.getDocument({ url }) //类型定义要求参数对象,可以包含 url、data、httpHeaders 等属性
    pdfDoc.value = await loadingTask.promise //等待加载完成
    totalPages.value = pdfDoc.value.numPages //获取总页数
    currentPage.value = 1 //默认显示第一页
    // 加载该页的标注
    loadAnnotationsForPage(1)

    // 等待模板中的 Canvas 完成更新，再开始获取 Canvas 上下文并渲染。
    await nextTick()
    await renderPage(1)
  } catch (error) {
    console.error('加载PDF失败:', error)
    alert('无法加载 PDF，请检查文件是否有效')
  } finally {
    isLoading.value = false
  }
}

//--------渲染指定页码的PDF--------
async function renderPage(pageNum: number) {
  if (!pdfDoc.value || !canvasRef.value || !annotationCanvasRef.value) return //确保PDF文档和Canvas存在

  // getPage 是异步操作，因为 PDF.js 可能还需要从文件中读取该页的数据。
  const page = await pdfDoc.value.getPage(pageNum)
  const canvas = canvasRef.value
  const annCanvas = annotationCanvasRef.value
  const context = canvas.getContext('2d')
  const annContext = annCanvas.getContext('2d')
  if (!context || !annContext) return

  // 获取容器宽度
  const containerWidth = containerRef.value?.clientWidth || 800
  const padding = 32
  const maxWidth = containerWidth - padding * 2

  // 基础缩放（适配宽度） × 用户缩放因子
  // 先用 scale: 1 获取 PDF 页面没有缩放时的原始尺寸。
  // 这里的 viewport.width 表示页面原始宽度，单位通常是 PDF.js 使用的像素单位。
  const baseviewport = page.getViewport({ scale: 1 }) //获取原始尺寸

  // 计算页面适配容器宽度所需要的基础比例。
  // 例如：容器可用宽度是 800，页面原始宽度是 1000，基础比例就是 0.8。
  // 这样渲染后的页面宽度就可以尽量填满容器，而不会超出容器。
  const baseScale = maxWidth / baseviewport.width //计算基础缩放比例

  // 在基础适配比例上，再乘以用户当前设置的缩放因子。
  // scaleFactor 为 1 表示保持适配宽度，0.5 表示缩小一半，2 表示放大两倍。
  // 这一步得到 PDF.js 最终真正使用的缩放比例。
  const finalScale = baseScale * scaleFactor.value //最终缩放比例

  const scaledViewport = page.getViewport({ scale: finalScale })

  // Canvas 的 width/height 决定实际绘图分辨率，两个 Canvas 必须使用完全相同的尺寸。
  // 设置 Canvas 尺寸
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height
  annCanvas.width = scaledViewport.width
  annCanvas.height = scaledViewport.height

  //渲染
  await page.render({
    canvasContext: context, // Canvas的2D上下文
    viewport: scaledViewport,
  }).promise

  // 渲染标注
  renderAnnotations(annContext, scaledViewport.width, scaledViewport.height)
}

//添加缩放控制函数
function zoomIn() {
  // Math.min 保证缩放比例不会超过允许的最大值。
  scaleFactor.value = Math.min(scaleFactor.value + 0.1, maxScale)
  renderPage(currentPage.value)
}

function zoomOut() {
  // Math.max 保证缩放比例不会低于允许的最小值。
  scaleFactor.value = Math.max(scaleFactor.value - 0.1, minScale)
  renderPage(currentPage.value)
}

function resetZoom() {
  // 将缩放因子恢复为 1，也就是重新适配容器宽度。
  scaleFactor.value = 1
  renderPage(currentPage.value)
}

// ---------- 标注渲染 ----------
function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
) {
  // 标注 Canvas 只负责绘制标注，因此每次绘制前先清空旧内容。
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const pageAnnotations = annotations.value.get(currentPage.value) || []
  currentPageAnnotations.value = pageAnnotations

  for (const ann of pageAnnotations) {
    // 标注保存的是 0 到 1 之间的比例，渲染时根据当前 Canvas 尺寸还原为像素坐标。
    const x = ann.x * canvasWidth
    const y = ann.y * canvasHeight
    const w = ann.width * canvasWidth
    const h = ann.height * canvasHeight

    ctx.save()
    ctx.strokeStyle = ann.color
    ctx.fillStyle = ann.color
    ctx.lineWidth = 2

    if (ann.type === 'highlight') {
      ctx.globalAlpha = 0.3
      ctx.fillRect(x, y, w, h)
    } else if (ann.type === 'underline') {
      ctx.globalAlpha = 0.8
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + w, y)
      ctx.stroke()
    } else if (ann.type === 'rectangle') {
      ctx.globalAlpha = 0.5
      ctx.strokeRect(x, y, w, h)
    }
    ctx.restore()
  }
}

// ---------- Canvas 事件（绘制标注） ----------
function getCanvasCoords(e: MouseEvent): { x: number; y: number } | null {
  const canvas = annotationCanvasRef.value
  if (!canvas) return null
  const rect = canvas.getBoundingClientRect()
  // CSS 尺寸和 Canvas 实际像素尺寸可能不同，需要分别计算横向和纵向的换算比例。
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

function onMouseDown(e: MouseEvent) {
  if (currentTool.value === 'hand') {
    isDragging.value = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragStartTranslateX = translateX.value
    dragStartTranslateY = translateY.value
    annotationCanvasRef.value!.style.cursor = 'grabbing'
    return
  }

  const coords = getCanvasCoords(e)
  if (!coords) return

  isDrawing = true
  startX = coords.x
  startY = coords.y

  const canvas = annotationCanvasRef.value
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height

  // 先创建一条尺寸为 0 的标注，尺寸会在鼠标移动时持续更新。
  currentAnnotation = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    type: currentTool.value as 'highlight' | 'underline' | 'rectangle',
    page: currentPage.value,
    x: startX / w,
    y: startY / h,
    width: 0,
    height: 0,
    color: drawColor.value,
  }
}

function onMouseMove(e: MouseEvent) {
  // 1. 优先处理抓手工具（独立于绘图逻辑）
  if (currentTool.value === 'hand' && isDragging.value) {
    const dx = e.clientX - dragStartX
    const dy = e.clientY - dragStartY
    translateX.value = dragStartTranslateX + dx
    translateY.value = dragStartTranslateY + dy
    applyTranslate()
    return
  }

  // 2. 如果不是绘制工具（select）或没有正在绘制，直接返回
  if (currentTool.value === 'select' || !isDrawing || !currentAnnotation) return

  // 3. 以下是绘图逻辑（高亮、下划线、矩形）
  const coords = getCanvasCoords(e)
  if (!coords) return

  const canvas = annotationCanvasRef.value
  if (!canvas) return
  const w = canvas.width
  const h = canvas.height

  const endX = Math.max(0, Math.min(coords.x, w))
  const endY = Math.max(0, Math.min(coords.y, h))

  currentAnnotation.x = Math.min(startX, endX) / w
  currentAnnotation.y = Math.min(startY, endY) / h
  currentAnnotation.width = Math.abs(endX - startX) / w
  currentAnnotation.height = Math.abs(endY - startY) / h

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const allAnnotations = [...(annotations.value.get(currentPage.value) || [])]
  const filtered = allAnnotations.filter((a) => a.id !== currentAnnotation!.id)
  const tempAnnotations = [...filtered, currentAnnotation]

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const tempMap = new Map()
  tempMap.set(currentPage.value, tempAnnotations)
  const savedMap = annotations.value
  annotations.value = tempMap
  renderAnnotations(ctx, canvas.width, canvas.height)
  annotations.value = savedMap
}

function onMouseUp(e: MouseEvent) {
  // 抓手工具处理
  if (currentTool.value === 'hand') {
    isDragging.value = false
    annotationCanvasRef.value!.style.cursor = 'grab'
    return
  }

  if (!isDrawing || !currentAnnotation || currentTool.value === 'select') {
    isDrawing = false
    return
  }

  // 检查是否有效（至少 5px）
  const minSize = 5 / (annotationCanvasRef.value?.width || 1000)
  if (currentAnnotation.width < minSize && currentAnnotation.height < minSize) {
    isDrawing = false
    currentAnnotation = null
    // 刷新
    refreshAnnotations()
    return
  }

  // 鼠标释放后，只有尺寸有效的标注才会正式保存到当前页。
  // 保存标注
  const page = currentPage.value
  if (!annotations.value.has(page)) {
    annotations.value.set(page, [])
  }
  annotations.value.get(page)!.push(currentAnnotation)

  // 更新当前页标注列表
  currentPageAnnotations.value = annotations.value.get(page) || []

  isDrawing = false
  currentAnnotation = null

  // 刷新
  refreshAnnotations()
}

function refreshAnnotations() {
  const canvas = annotationCanvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  renderAnnotations(ctx, canvas.width, canvas.height)
}

function loadAnnotationsForPage(page: number) {
  // 翻页或加载 PDF 时，只更新当前页对应的标注列表。
  currentPageAnnotations.value = annotations.value.get(page) || []
}

function saveAnnotations() {
  // Map 不能直接被 JSON.stringify，因此先转换成普通对象再保存到 localStorage。
  const data: Record<number, Annotation[]> = {}
  for (const [key, value] of annotations.value) {
    data[key] = value
  }
  localStorage.setItem('pdfAnnotations', JSON.stringify(data))
}

function loadAnnotations() {
  // localStorage 中没有数据时不执行后续解析和重绘。
  const raw = localStorage.getItem('pdfAnnotations')
  if (!raw) return

  try {
    // JSON 对象的键只能是字符串，这里重新转换为数字页码并恢复成 Map。
    const data = JSON.parse(raw) as Record<number, Annotation[]>
    annotations.value = new Map(Object.entries(data).map(([key, value]) => [Number(key), value]))
    loadAnnotationsForPage(currentPage.value)
    refreshAnnotations()
  } catch (error) {
    console.error('加载标注失败:', error)
  }
}

function clearAnnotations() {
  // 标注按页保存，因此清除操作只影响当前正在查看的页面。
  annotations.value.delete(currentPage.value)
  currentPageAnnotations.value = []
  refreshAnnotations()
}

//--------翻页--------
async function prevPage() {
  // 只有当前页不是第一页时，才允许向前翻页。
  if (currentPage.value > 1) {
    //确保当前页码大于1
    currentPage.value-- //减少当前页码
    await renderPage(currentPage.value) //渲染上一页
  }
}

async function nextPage() {
  // 只有当前页不是最后一页时，才允许向后翻页。
  if (currentPage.value < totalPages.value) {
    //确保当前页码小于总页数
    currentPage.value++ //增加当前页码
    await renderPage(currentPage.value) //渲染下一页
  }
}

function handleResize() {
  // 容器宽度变化后重新计算适配比例，保证 PDF 和标注层保持同步。
  if (pdfDoc.value) {
    renderPage(currentPage.value)
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
  }
})

// 监听窗口变化，使 PDF 阅读器能够响应式调整页面大小。
window.addEventListener('resize', handleResize)
</script>

<style scoped>
.pdf-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-md);
}

.toolbar {
  position: fixed;
  z-index: 1000;
  background: var(--color-bg-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  padding: var(--spacing-sm) 12px;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  border: 1px solid var(--color-border);
  user-select: none;
  cursor: default;
  /* 初始位置由 style 控制 */
}

.toolbar-drag-handle {
  cursor: grab;
  color: var(--color-text-placeholder);
  padding: 0 6px;
  font-size: var(--font-size-sm);
  letter-spacing: 2px;
  user-select: none;
}
.toolbar-drag-handle:hover {
  color: var(--color-text);
}
.toolbar-drag-handle:active {
  cursor: grabbing;
}

.upload-btn {
  display: inline-block;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-primary);
  color: #fff;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-md);
  transition: background var(--transition-fast);
}
.upload-btn:hover {
  background: var(--color-primary-hover);
}
.upload-btn input {
  display: none;
}

.divider {
  color: var(--color-divider);
  margin: 0 var(--spacing-xs);
}

.pdf-wrapper {
  position: relative;
  display: inline-block;
  line-height: 0;
  transition: transform var(--transition-fast); /* 可选：让拖拽更平滑 */
}

.tool-btn {
  padding: 6px 14px;
  border: 2px solid transparent;
  border-radius: var(--radius-md);
  background: var(--color-bg-white);
  cursor: pointer;
  font-size: var(--font-size-md);
  transition: all var(--transition-normal);
}
.tool-btn:hover {
  background: var(--color-bg-hover);
}
.tool-btn.active {
  border-color: var(--color-primary);
  background: var(--color-bg-primary);
}

.page-controls {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin: var(--spacing-sm) 0;
}
.page-controls button {
  padding: 6px var(--spacing-md);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-white);
  cursor: pointer;
}
.page-controls button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* ====== 关键修复：PDF 容器 ====== */
.pdf-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: auto;
  background: var(--color-bg);
  min-height: 500px;
  padding: var(--spacing-md);
  display: flex;
  justify-content: center;
  align-items: flex-start;
}

.pdf-wrapper {
  position: relative;
  display: inline-block;
  /* 关键：让 wrapper 只包裹 canvas 本身，不额外占用空间 */
  line-height: 0;
}

.pdf-wrapper canvas {
  display: block;
  max-width: 100%;
  height: auto;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ====== 关键修复：标注图层直接覆盖在 PDF Canvas 之上 ====== */
.annotation-layer {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  cursor: crosshair;
  background: transparent;
  /* 确保鼠标事件穿透到标注层，但保留在 canvas 上 */
  pointer-events: auto;
}

.placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: var(--color-text-placeholder);
  font-size: var(--font-size-lg);
}

.loading {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-lg);
}

.zoom-display {
  display: inline-block;
  min-width: 48px;
  text-align: center;
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-bg-white);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border);
}
</style>
