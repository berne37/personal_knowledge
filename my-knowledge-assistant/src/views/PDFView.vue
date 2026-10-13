<template>
  <!-- chats: 2026-10-10 用户定稿——PDF 页不要页头，阅读器自己就是一整页；
       2026-10-13 暗色读书模式整体下线，配色回归全站亮色令牌 -->
  <div class="pdf-view">
    <!-- 工具栏 -->
    <!-- chats: 工具栏改竖排圆形图标栏（2026-10-10 参考读书站右侧圆钮）——
         保留可拖动（顶部手柄圆钮）与可隐藏（末尾收起钮，隐藏后右侧浮标唤回）。
         图标只表意，悬停 title 给文字提示；active 靠底色高亮 -->
    <div
      v-show="!railHidden"
      class="toolbar"
      :class="{ dragging: isToolbarDragging }"
      :style="{
        left: toolbarPosition.x + 'px',
        top: toolbarPosition.y + 'px',
      }"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <label class="toolbar-drag-handle" title="拖动移动工具栏"
        ><GripHorizontal :size="16"
      /></label>

      <label class="rail-btn upload-btn" title="上传PDF文件">
        <FileUp :size="18" />
        <input type="file" accept="application/pdf" @change="handleFileUpload" />
      </label>

      <button class="rail-btn" title="缩小" @click="zoomOut"><ZoomOut :size="18" /></button>
      <span class="zoom-display" title="当前缩放">{{ Math.round(scaleFactor * 100) }}%</span>
      <button class="rail-btn" title="放大" @click="zoomIn"><ZoomIn :size="18" /></button>
      <button class="rail-btn" title="适应宽度" @click="resetZoom"><Maximize :size="18" /></button>

      <!-- chats: 版式切换合并为单按钮（2026-10-13 用户要求）——每点一次在双页/单页间切换。
           图标显示「点击后会切到的模式」：单页时亮双页图标，双页时亮单页图标，
           悬停提示跟着变，不用 active 高亮（图标本身已经表达了状态） -->
      <button
        class="rail-btn"
        :title="viewMode === 'double' ? '切换为竖向单页' : '切换为左右双页'"
        @click="toggleViewMode"
      >
        <BookOpen v-if="viewMode === 'single'" :size="18" />
        <FileText v-else :size="18" />
      </button>

      <button
        class="rail-btn"
        :class="{ active: currentTool === 'hand' }"
        title="抓手（拖动页面）"
        @click="setTool('hand')"
      >
        <Hand :size="18" />
      </button>
      <button
        class="rail-btn"
        :class="{ active: currentTool === 'select' }"
        title="选择"
        @click="setTool('select')"
      >
        <MousePointer2 :size="18" />
      </button>
      <button
        class="rail-btn"
        :class="{ active: currentTool === 'highlight' }"
        title="高亮"
        @click="setTool('highlight')"
      >
        <Highlighter :size="18" />
      </button>
      <button
        class="rail-btn"
        :class="{ active: currentTool === 'underline' }"
        title="下划线"
        @click="setTool('underline')"
      >
        <Underline :size="18" />
      </button>
      <button
        class="rail-btn"
        :class="{ active: currentTool === 'rectangle' }"
        title="矩形"
        @click="setTool('rectangle')"
      >
        <Square :size="18" />
      </button>

      <button class="rail-btn" title="清除标注" @click="clearAnnotations">
        <Eraser :size="18" />
      </button>
      <button class="rail-btn" title="保存标注" @click="saveAnnotations">
        <Save :size="18" />
      </button>
      <button class="rail-btn" title="加载标注" @click="loadAnnotations">
        <FolderOpen :size="18" />
      </button>

      <button class="rail-btn rail-hide" title="隐藏工具栏" @click="railHidden = true">
        <ChevronRight :size="18" />
      </button>
    </div>

    <!-- 工具栏隐藏后的唤回浮标（贴右侧居中） -->
    <button v-if="railHidden" class="rail-fab" title="显示工具栏" @click="railHidden = false">
      <Wrench :size="18" />
    </button>

    <!-- PDF 渲染容器：没上传时不渲染这个空 box，只显示下方占位提示。
         chats: 翻页控制 sticky 随滚动换边（见样式区） -->
    <div v-if="pdfUrl" class="pdf-container" ref="containerRef" @scroll="onContainerScroll">
      <!-- chats: 翻页控制随滚动位置换边（2026-10-13 用户要求）——
           滚动条在顶时贴顶（开卷时先看到），滚离顶部后换到贴底（读到哪跟到哪） -->
      <div class="page-controls" :class="{ 'at-bottom': !isAtTop }">
        <button class="page-btn" @click="prevPage" :disabled="currentPage <= 1">‹ 上一页</button>
        <span class="page-indicator" :title="pdfName">
          第 {{ currentPage
          }}<template v-if="viewMode === 'double' && currentPage < totalPages"
            >–{{ currentPage + 1 }}</template
          >
          页 / 共 {{ totalPages }} 页
        </span>
        <button class="page-btn" @click="nextPage" :disabled="currentPage === totalPages">
          下一页 ›
        </button>
      </div>

      <div class="pdf-wrapper" ref="wrapperRef" :class="{ double: viewMode === 'double' }">
        <div class="page-slot">
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
        <!-- chats: 左右双页的 B 槽——渲染当前页的下一页（2026-10-10 用户要求可切换版式） -->
        <div v-if="viewMode === 'double' && currentPage < totalPages" class="page-slot">
          <canvas ref="canvasRefB"></canvas>
          <canvas
            ref="annotationCanvasRefB"
            class="annotation-layer"
            @mousedown="onMouseDown"
            @mousemove="onMouseMove"
            @mouseup="onMouseUp"
            @mouseleave="onMouseUp"
          ></canvas>
        </div>
      </div>
      <div v-if="isLoading" class="loading"><span class="spinner"></span></div>
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
// chats: 工具栏图标（竖排圆钮栏，2026-10-10）——拖动手柄 + 功能圆钮 + 收起/唤回
import {
  BookOpen,
  ChevronRight,
  Eraser,
  FileText,
  FileUp,
  FolderOpen,
  GripHorizontal,
  Hand,
  Highlighter,
  Maximize,
  MousePointer2,
  Save,
  Square,
  Underline,
  Wrench,
  ZoomIn,
  ZoomOut,
} from 'lucide-vue-next'
// pdfjsLib 负责解析 PDF，worker 用于将解析工作放到独立线程中执行。
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
// chats: PDF 持久化（2026-10-10）——字节抄进 OPFS，重启后阅读器自动恢复上次的 PDF
import { loadLastPdf, saveLastPdf } from '@/services/pdfPersistence'

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
// chats: 当前 PDF 的文件名（2026-10-10 持久化附带）——恢复后给用户确认读的是哪份
const pdfName = ref('')
// PDFDocumentProxy 内部包含私有字段，因此使用 shallowRef 避免被 Vue 深层代理。
const pdfDoc = shallowRef<pdfjsLib.PDFDocumentProxy | null>(null)
// 当前页码、总页数和加载状态会直接影响模板显示。
const currentPage = ref(1)
const totalPages = ref(0)
const isLoading = ref(false)

// chats: 翻页条换边（2026-10-13 用户要求）——滚动条在顶部时贴顶、滚离后贴底。
// 阈值 4px 吸收滚动取整的抖动，避免在 0px 附近来回跳
const isAtTop = ref(true)
function onContainerScroll(e: Event) {
  isAtTop.value = (e.target as HTMLElement).scrollTop <= 4
}

// 这些 ref 用于获取模板中的 DOM 元素，只有组件挂载后才可能有实际值。
const canvasRef = ref<HTMLCanvasElement | null>(null)
const annotationCanvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)
// chats: 左右双页版式的 B 槽画布（2026-10-10）——A 槽显示 currentPage，B 槽显示 currentPage+1。
// 标注按页码存在 Map 里，所以版式切换不需要动标注数据结构
const canvasRefB = ref<HTMLCanvasElement | null>(null)
const annotationCanvasRefB = ref<HTMLCanvasElement | null>(null)
// 阅读版式：single 竖向单页 / double 左右双页
const viewMode = ref<'single' | 'double'>('single')

// 平移偏移量（用于抓手工具）
const translateX = ref(0)
const translateY = ref(0)

// 拖拽临时变量
let dragStartX = 0
let dragStartY = 0
let dragStartTranslateX = 0
let dragStartTranslateY = 0

// 工具栏位置（默认右侧停靠）
const toolbarPosition = ref({ x: 0, y: 0 })
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
// chats: 工具栏拖动要有视觉反馈（2026-10-10 用户参考可拖拽组件）——
// 单独建状态，不复用 isDragging（它被抓手拖页面占了，共用会让拖页面时工具栏也高亮）
const isToolbarDragging = ref(false)
// chats: 工具栏可隐藏（2026-10-10 用户要求保留可拖动 + 可隐藏）——
// 隐藏后由右缘浮标 .rail-fab 唤回
const railHidden = ref(false)

onMounted(async () => {
  // 初始位置：贴屏幕右上角（右缘与顶部都只留 4px 防裁切余量）
  toolbarPosition.value = {
    x: window.innerWidth - 60,
    y: 4,
  }
  // chats: 等 DOM 渲染完量一次真实尺寸再收敛（2026-10-10 修收起钮被挡）——
  // 工具栏很高，若屏幕矮会超出下缘，clamp 会把 y 往回收
  await nextTick()
  clampPosition()

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
        pdfName.value = file.name
        saveLastPdf(file) // chats: 顺手抄进 OPFS，重启后没新任务时由下方兜底恢复
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
  } else {
    // chats: 没有新任务 → 恢复上次在读的 PDF（2026-10-10 持久化）。
    // 句柄权限活着的场景走不到这（上面已打开），所以恢复不抢正常流程的位
    const last = await loadLastPdf()
    if (last) {
      const objUrl = URL.createObjectURL(last.file)
      pdfUrl.value = objUrl
      pdfName.value = last.name
      loadPDF(objUrl)
    }
  }
})

//在窗口 resize 时调整位置防止超出
function clampPosition() {
  const toolbarEl = document.querySelector('.toolbar') as HTMLElement
  if (!toolbarEl) return
  const rect = toolbarEl.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width - 4 // chats: 贴右缘（2026-10-10 用户要求），只留防裁切余量
  const maxY = window.innerHeight - rect.height - 4 // chats: 顶部同理贴合（2026-10-10 用户要求）
  toolbarPosition.value = {
    x: Math.max(4, Math.min(toolbarPosition.value.x, maxX)),
    y: Math.max(4, Math.min(toolbarPosition.value.y, maxY)),
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
  isToolbarDragging.value = true // chats: 驱动 .toolbar.dragging 的放大 + 阴影反馈
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
  isToolbarDragging.value = false
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
let drawingPage = 1 // 正在绘制的页码（双页模式下可能画在 B 槽那一页，不能写死 currentPage）
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

  // chats: 双页版式下两个槽的标注层都要换光标（2026-10-10），B 槽可能未挂载
  const cursor = tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : 'crosshair'
  for (const c of [annotationCanvasRef.value, annotationCanvasRefB.value]) {
    if (c) c.style.cursor = cursor
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
  pdfName.value = file.name

  // chats: 抄一份进 OPFS（2026-10-10 持久化）——上传的 blob URL 刷新就没，重启后靠这份恢复
  saveLastPdf(file)

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

// chats: 渲染任务管理（2026-10-10 修版式切换卡死）——
// pdf.js 禁止同一个 canvas 同时跑两个渲染任务：快速连点「双页⇄单页」或缩放时，
// 上一个 render 还没落定新的就压上去，会抛
// 「Cannot use the same canvas during multiple render() operations」，之后该槽画不出来。
// 对策：每个槽记住进行中的任务，重画前先取消旧的、等它真正退出再开新的
const renderTaskA: { current: pdfjsLib.RenderTask | null } = { current: null }
const renderTaskB: { current: pdfjsLib.RenderTask | null } = { current: null }

//--------渲染指定页码的PDF--------
// chats: 双页版式重构（2026-10-10）——把「算缩放 + 画到某组 canvas」抽成 renderPageTo，
// maxWidth 由 renderPage 按版式算好传入；renderPage 只负责决定渲染哪些槽：
// 单页只有 A 槽（currentPage），双页再加 B 槽（currentPage+1）
async function renderPageTo(
  canvas: HTMLCanvasElement,
  annCanvas: HTMLCanvasElement,
  pageNum: number,
  maxWidth: number,
  taskBox: { current: pdfjsLib.RenderTask | null },
) {
  if (!pdfDoc.value) return

  // getPage 是异步操作，因为 PDF.js 可能还需要从文件中读取该页的数据。
  const page = await pdfDoc.value.getPage(pageNum)
  const context = canvas.getContext('2d')
  const annContext = annCanvas.getContext('2d')
  if (!context || !annContext) return

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

  // chats: 渲染前先清场（2026-10-10）——上一个任务还在画就 cancel 并等它退出，
  // 否则下面改 canvas.width 和新 render 都会和旧任务打架
  if (taskBox.current) {
    try {
      taskBox.current.cancel()
    } catch {
      // 任务已结束的 cancel 可能报错，忽略
    }
    try {
      // cancel 会让旧 promise 以取消异常落定，这里必须 await 等 canvas 真正空闲
      await taskBox.current.promise
    } catch {
      // 取消异常是预期内的，吞掉
    }
    taskBox.current = null
  }

  // Canvas 的 width/height 决定实际绘图分辨率，两个 Canvas 必须使用完全相同的尺寸。
  // 设置 Canvas 尺寸
  canvas.width = scaledViewport.width
  canvas.height = scaledViewport.height
  annCanvas.width = scaledViewport.width
  annCanvas.height = scaledViewport.height

  //渲染
  const task = page.render({
    canvasContext: context, // Canvas的2D上下文
    viewport: scaledViewport,
  })
  taskBox.current = task
  try {
    await task.promise
  } catch {
    // 被更新的渲染取消了（如连点切换/缩放）：这次作废，标注也别画，交给最新那次
    taskBox.current = null
    return
  }
  taskBox.current = null

  // 渲染标注（注意传本槽的页码，双页模式下 B 槽是另一页）
  renderAnnotations(annContext, scaledViewport.width, scaledViewport.height, pageNum)
}

async function renderPage(pageNum: number) {
  if (!pdfDoc.value || !canvasRef.value || !annotationCanvasRef.value) return //确保PDF文档和Canvas存在

  // chats: 缩放按版式分配可用宽度（2026-10-10 修双页缩放无效）——
  // 原来两个槽各按整个容器宽算，两页加起来超宽，全靠 CSS 压回去，缩放看起来没反应。
  // 双页时先扣掉两页之间的 gap（--spacing-md），再均分给两个槽
  const containerWidth = containerRef.value?.clientWidth || 800
  const padding = 32
  let maxWidth = containerWidth - padding * 2
  if (viewMode.value === 'double') {
    maxWidth = (maxWidth - 16) / 2 // 16 = --spacing-md（gap），与样式区保持一致
  }

  await renderPageTo(canvasRef.value, annotationCanvasRef.value, pageNum, maxWidth, renderTaskA)

  // 双页模式且有下一页时，B 槽渲染下一页（模板里 B 槽的 v-if 与此条件保持一致）
  if (viewMode.value === 'double' && pageNum < totalPages.value) {
    if (canvasRefB.value && annotationCanvasRefB.value) {
      await renderPageTo(
        canvasRefB.value,
        annotationCanvasRefB.value,
        pageNum + 1,
        maxWidth,
        renderTaskB,
      )
    }
  }
}

// chats: 版式切换单按钮（2026-10-13 用户要求两按钮合一）——
// 每点一次在双页/单页间切换，图标由模板按当前模式二选一渲染；
// 切到双页要等 B 槽的 canvas 真正挂载到 DOM 后才能画，所以先 nextTick 再渲染
async function setViewMode(mode: 'single' | 'double') {
  if (viewMode.value === mode) return
  viewMode.value = mode
  await nextTick()
  await renderPage(currentPage.value)
}

async function toggleViewMode() {
  await setViewMode(viewMode.value === 'double' ? 'single' : 'double')
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
// chats: 加了 page 参数（2026-10-10 双页版式）——A 槽画 currentPage，B 槽画 currentPage+1，
// 默认值兜底单页场景
function renderAnnotations(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  page: number = currentPage.value,
) {
  // 标注 Canvas 只负责绘制标注，因此每次绘制前先清空旧内容。
  ctx.clearRect(0, 0, canvasWidth, canvasHeight)

  const pageAnnotations = annotations.value.get(page) || []
  if (page === currentPage.value) currentPageAnnotations.value = pageAnnotations

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
// chats: 双页模式下鼠标可能落在 A 槽或 B 槽（2026-10-10）——
// 用触发元素的身份反查是哪个槽，进而得到本槽页码和标注 canvas，不用改模板传参
function getSlot(e: MouseEvent) {
  const isB = e.currentTarget === annotationCanvasRefB.value
  return {
    page: isB ? currentPage.value + 1 : currentPage.value,
    annCanvas: (isB ? annotationCanvasRefB : annotationCanvasRef).value,
  }
}

function getCanvasCoords(e: MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
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
  const slot = getSlot(e)

  if (currentTool.value === 'hand') {
    isDragging.value = true
    dragStartX = e.clientX
    dragStartY = e.clientY
    dragStartTranslateX = translateX.value
    dragStartTranslateY = translateY.value
    // 抓手拖动作用于整个 wrapper（平移偏移量），与具体哪个槽无关
    if (slot.annCanvas) slot.annCanvas.style.cursor = 'grabbing'
    return
  }

  const canvas = slot.annCanvas
  if (!canvas) return

  const coords = getCanvasCoords(e, canvas)
  isDrawing = true
  drawingPage = slot.page // chats: 记下画在哪个槽的页，后续 move/up 都按这页处理
  startX = coords.x
  startY = coords.y
  const w = canvas.width
  const h = canvas.height

  // 先创建一条尺寸为 0 的标注，尺寸会在鼠标移动时持续更新。
  currentAnnotation = {
    id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
    type: currentTool.value as 'highlight' | 'underline' | 'rectangle',
    page: slot.page,
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
  const canvas = getSlot(e).annCanvas
  if (!canvas) return

  const coords = getCanvasCoords(e, canvas)
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

  // chats: 原地预览——把「本页已有标注 + 正在画的这条」临时渲染出来，
  // 不动 annotations.value 本体（画完 mouseup 才正式入表）
  const allAnnotations = [...(annotations.value.get(drawingPage) || [])]
  const filtered = allAnnotations.filter((a) => a.id !== currentAnnotation!.id)
  const tempAnnotations = [...filtered, currentAnnotation]

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  const tempMap = new Map()
  tempMap.set(drawingPage, tempAnnotations)
  const savedMap = annotations.value
  annotations.value = tempMap
  renderAnnotations(ctx, canvas.width, canvas.height, drawingPage)
  annotations.value = savedMap
}

function onMouseUp(e: MouseEvent) {
  const slot = getSlot(e)

  // 抓手工具处理
  if (currentTool.value === 'hand') {
    isDragging.value = false
    if (slot.annCanvas) slot.annCanvas.style.cursor = 'grab'
    return
  }

  if (!isDrawing || !currentAnnotation || currentTool.value === 'select') {
    isDrawing = false
    return
  }

  // 检查是否有效（至少 5px）
  const minSize = 5 / (slot.annCanvas?.width || 1000)
  if (currentAnnotation.width < minSize && currentAnnotation.height < minSize) {
    isDrawing = false
    currentAnnotation = null
    // 刷新
    refreshAnnotations()
    return
  }

  // 鼠标释放后，只有尺寸有效的标注才会正式保存到「开始绘制的那一页」。
  // chats: 双页版式下用 drawingPage 而不是 currentPage（可能画在 B 槽）
  const page = drawingPage
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
  // chats: 双页模式下两个槽各刷各的页（2026-10-10）——B 槽在单页模式或最后一页时不存在
  if (annotationCanvasRef.value) {
    const ctx = annotationCanvasRef.value.getContext('2d')
    if (ctx)
      renderAnnotations(
        ctx,
        annotationCanvasRef.value.width,
        annotationCanvasRef.value.height,
        currentPage.value,
      )
  }
  if (viewMode.value === 'double' && annotationCanvasRefB.value) {
    const ctx = annotationCanvasRefB.value.getContext('2d')
    if (ctx)
      renderAnnotations(
        ctx,
        annotationCanvasRefB.value.width,
        annotationCanvasRefB.value.height,
        currentPage.value + 1,
      )
  }
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
  // chats: 双页版式下一屏有两页，两页的标注一起清（2026-10-10）
  annotations.value.delete(currentPage.value)
  if (viewMode.value === 'double') {
    annotations.value.delete(currentPage.value + 1)
  }
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

// chats: 方向键翻页（2026-10-10 用户要求）——← = 上一页，→ = 下一页。
// 两个让路条件：焦点在输入框（箭头要移光标）、PDF 还没加载（没页可翻）。
// 注：标注绘制用鼠标，方向键不会和绘图冲突
function handleKeydown(e: KeyboardEvent) {
  if (!pdfUrl.value) return
  const target = e.target as HTMLElement | null
  if (target?.closest('input, textarea, [contenteditable]')) return
  if (e.key === 'ArrowLeft' && currentPage.value > 1) {
    prevPage()
  } else if (e.key === 'ArrowRight' && currentPage.value < totalPages.value) {
    nextPage()
  }
}
window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.pdf-view {
  max-width: 1100px;
  margin: 0 auto;
  padding: var(--spacing-md);
}

/* chats: 竖排圆形图标栏（2026-10-10 参考读书站右侧圆钮）——白卡圆轨，可拖动可隐藏 */
.toolbar {
  position: fixed;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 10px 8px;
  background: var(--color-bg-white);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  box-shadow: var(--shadow-lg);
  user-select: none;
  cursor: default;
  /* chats: 屏幕矮时栏内滚动（2026-10-10 修收起钮被挡出屏幕）——隐藏滚动条保持圆轨外观 */
  max-height: calc(100vh - 8px);
  overflow-y: auto;
  scrollbar-width: none;
  /* 过渡放基类：拖起和松手回弹都有动画（只放 .dragging 里松手就会瞬跳） */
  transition:
    transform var(--transition-fast),
    box-shadow var(--transition-fast);
}
.toolbar::-webkit-scrollbar {
  display: none;
}
.toolbar.dragging {
  /* chats: 拖动视觉反馈（2026-10-10 用户参考可拖拽组件）——放大一点 + 阴影加深 + 抓取光标；
   transform 只做缩放，定位仍由 left/top 负责，互不干扰 */
  transform: scale(1.05);
  box-shadow: var(--shadow-xl);
  cursor: grabbing;
}

.toolbar-drag-handle {
  cursor: grab;
  color: var(--color-text-placeholder);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 24px;
  border-radius: 999px;
  user-select: none;
}
.toolbar-drag-handle:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}
.toolbar-drag-handle:active {
  cursor: grabbing;
}

/* chats: 圆形图标按钮——icon 只表意，文字提示走 title；active 主色浅底 */
.rail-btn {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}
.rail-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}
.rail-btn.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
/* 上传圆钮：栏里的主操作，主色实心 */
.rail-btn.upload-btn {
  background: var(--color-primary);
  color: #fff;
}
.rail-btn.upload-btn:hover {
  background: var(--color-primary-hover);
}
.rail-btn.upload-btn input {
  display: none;
}
.rail-hide {
  margin-top: 2px;
}

/* 工具栏隐藏后的唤回浮标：贴右侧居中 */
.rail-fab {
  position: fixed;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1000;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-bg-white);
  box-shadow: var(--shadow-md);
  color: var(--color-text-secondary);
  cursor: pointer;
}
.rail-fab:hover {
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.pdf-wrapper {
  position: relative;
  display: inline-block;
  line-height: 0;
  transition: transform var(--transition-fast); /* 可选：让拖拽更平滑 */
}

.zoom-display {
  min-width: 40px;
  text-align: center;
  font-size: var(--font-size-xs);
  font-weight: 500;
  color: var(--color-text);
  background: var(--color-bg);
  padding: 2px 0;
  border-radius: var(--radius-sm);
}

/* ====== 关键修复：PDF 容器 ====== */
/* chats: 高度锁视口（2026-10-13 修翻页条贴底失效）——
   容器高度若由内容撑开，overflow:auto 永远不会真滚动（滚动会发生在页面上），
   sticky 在不自滚的容器里不生效。96px = .content 上下 2*32 + .pdf-view 上下 2*16，
   容器自己成为滚动区（容器内滚动条 = 用户 2026-10-13 拍板保留的原生滚动条），
   翻页条的 sticky 换边才有锚 */
.pdf-container {
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: auto;
  background: var(--color-bg);
  height: calc(100vh - 2 * var(--spacing-xl) - 2 * var(--spacing-md));
  padding: var(--spacing-md);
  /* chats: 改纵向 flex——wrapper 居中，page-controls 靠 margin-top:auto 贴底 */
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* chats: 翻页控制默认贴顶：DOM 在内容前 + sticky 贴滚动容器顶缘，margin-bottom:auto 把内容压到下方 */
.page-controls {
  position: sticky;
  top: 0;
  align-self: stretch;
  margin-bottom: auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: var(--spacing-md);
  z-index: 5; /* 盖过页面内容，滚动时翻页钮不被 canvas 压住 */
}

/* chats: 滚离顶部后翻页条换到贴底（2026-10-13 用户要求）——
   order 挪到内容之后 + margin-top:auto 压底 + sticky bottom 钉在可视区下缘；
   内容不足一屏时 free space 被 auto margin 吃掉，条子沉到容器底部，同样正确 */
.page-controls.at-bottom {
  top: auto;
  bottom: 0;
  order: 1;
  margin-top: auto;
  margin-bottom: 0;
  padding-bottom: 0;
  padding-top: var(--spacing-md);
}
.page-btn {
  padding: 6px 18px;
  border: 1px solid var(--color-border);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}
.page-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-indicator {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
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

/* chats: 左右双页版式（2026-10-10 用户要求）——
   两个 page-slot 并排像摊开的书；flex:1 让两页均分宽度，min-width:0 允许 canvas 收缩。
   单页模式不加 double 类，page-slot 的 relative 定位保证标注层照常覆盖 */
.page-slot {
  position: relative;
  display: inline-block;
  line-height: 0;
}
.pdf-wrapper.double {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
}
.pdf-wrapper.double .page-slot {
  flex: 1 1 0;
  min-width: 0;
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

/* chats: 加载圆环 spinner（参考件同款，替代 ⏳ 文字）；配色跟亮色底走令牌 */
.spinner {
  width: 28px;
  height: 28px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: pdf-spin 1s linear infinite;
}
@keyframes pdf-spin {
  to {
    transform: rotate(360deg);
  }
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
