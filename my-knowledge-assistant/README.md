# 个人知识助手（My Knowledge Assistant）

本地优先（local-first）的个人学习工作台：资料存在你自己电脑上、默认不上云，AI 默认只用你自己的知识库来回答。适合边学边整理笔记、沉淀技能、做学习项目管理。

## 功能模块

1. **知识库**：树形结构（条目 + 子条目），支持增删改查、搜索筛选。详情页分四个标签页——概览（含 AI 生成的思维导图）、知识笔记（就地编辑）、知识关系、资料附件。
2. **知识关系**：条目间可手动声明「前置知识 / 相关知识 / 相关资料 / 相关项目」；反向「依赖我的」读取时全库动态计算，删除条目时自动清理全库指向它的死引用，不会留下「未知条目」。
3. **AI 对话**：流式逐字回答，默认把知识库内容拼进上下文，让 AI 基于你自己的资料作答。设置页可自定义 API Key / 模型 / 接口地址。
4. **思维导图**：基于知识库内容用 AI 生成脑图，simple-mind-map 渲染；卡片随内容自适应尺寸，大图滚动查看不裁切，小图自动居中；生成结果持久化保存。
5. **PDF 阅读**：pdfjs-dist 渲染 + 双 canvas 分层（渲染层 / 标注层分离），支持高亮、下划线、矩形三类标注与抓手拖拽、翻页缩放，标注数据持久化。从知识库详情页跳入阅读。
6. **项目管理**：建项目、拆节点、记进度、挂附件（仅记录本地文件路径，不暴露内容）。
7. **新手引导**：首次打开自动弹欢迎卡 + 聚光灯分步 tour，看过后记进 localStorage，侧边栏可随时重看。

## 技术栈

- 前端框架：Vue 3 + TypeScript + Vite
- 状态管理：Pinia（setup 风格 store）
- 路由：Vue Router
- 本地存储：IndexedDB（用 `idb` 封装）
- 关键依赖：`pdfjs-dist`（PDF 渲染）、`simple-mind-map`（脑图）
- AI 接口：DeepSeek / OpenAI 兼容的 Chat Completions，支持流式输出

## 架构设计

- **local-first 原则**：业务数据存在浏览器 IndexedDB，默认不联网、不上传服务器；AI 调用走用户自己的 Key。
- **状态层**：`src/stores/` 下多个 Pinia store（knowledge / mindmap / project / PDF），每个 store 用 setup 写法，**要 return 出去的才外部可用**。
- **AI 配置层**：`resolveAiConfig()` 按「用户设置 > 环境变量 > 默认值」三级合并；用户设置由设置页写进 localStorage。
- **路由**：`/knowledge/:id`（用 id 不用 title，避免同名条目跳错），组件复用时靠 `watch` 路由参数重新加载数据。
- **设计令牌**：`tokens.css` + `global.css` 统一管理 CSS 变量（颜色 / 圆角 / 间距），组件里不写死色值。

## 目录结构

```text
my-knowledge-assistant/
├── src/
│   ├── components/      # 通用组件 + OnboardingGuide（新手引导）
│   ├── services/        # ai.ts(对话) / aiConfig.ts(配置层) / mindMap.ts(脑图)
│   ├── stores/          # Pinia：knowledge / mindmap / project / PDF
│   ├── views/           # 页面：知识库/详情/AI对话/思维导图/PDF/项目/设置
│   ├── router/          # 路由表
│   ├── style/           # tokens.css + global.css 设计令牌
│   ├── types/           # 类型定义（KnowledgeItem 等）
│   ├── App.vue          # 侧边栏布局 + 引导挂载
│   └── main.ts
├── package.json
├── vite.config.ts
└── README.md
```

## 代码地图（改哪里看这里）

| 想改的东西 | 去哪个文件 |
| --- | --- |
| 知识树、增删改查、父子条目 | `src/stores/knowledgeStore.ts` |
| AI 对话调用、流式、模型参数 | `src/services/ai.ts` |
| AI Key / 模型 / 地址配置 | `src/services/aiConfig.ts` + `src/views/SettingsView.vue` |
| 思维导图生成 / 解析 | `src/services/mindMap.ts` + `src/components/MindMap.vue` |
| PDF 渲染、标注、空态 | `src/views/PDFView.vue` + `src/stores/PDFStore.ts` |
| 新手引导步骤 / 文案 | `src/components/OnboardingGuide.vue` + `App.vue` 侧边栏 `data-tour` |
| 数据字段（如 notes） | `src/types/index.ts` |

## 快速开始

```bash
npm install      # 装依赖
npm run dev      # 起开发服务器，默认 http://localhost:5173（被占用会顺延 5174）
```

其他脚本：

```bash
npm run build      # 生产构建（含类型检查）
npm run preview    # 预览构建产物
npm run test:unit  # 跑 Vitest 单元测试
npm run type-check # 仅做 vue-tsc 类型检查
npm run lint       # ESLint / Oxlint
npm run format     # Prettier 格式化
```

## 配置 AI（两种方式，可并存）

- **方式一 · 设置页（推荐）**：打开左侧「设置」，直接填 API Key、模型名、接口地址，存进浏览器 localStorage，不用动环境变量。
- **方式二 · 环境变量**：根目录建 `.env`，填 `VITE_AI_API_BASE` / `VITE_AI_API_KEY` / `VITE_AI_MODEL` / `VITE_MINDMAP_AI_MODEL`（可选 `VITE_AI_MAX_TOKENS` 控制单次回复上限）。

优先级：**用户在设置页填的 > .env > 代码默认值**。

## 安全说明（面试常被问）

API Key 当前只存在本机浏览器 localStorage，仅本地使用、不上传任何服务器。后续若把项目做成 Tauri 桌面端，可把 Key 挪进系统密钥库，进一步加固。

## 几个有代表性的技术点

- **IndexedDB 结构化克隆**：Vue 的 reactive Proxy 不能直接 `put` 进 IndexedDB（DataCloneError），在 store 写入入口统一 `toRaw` 剥代理。
- **容器宽度塌缩导致组件静默不渲染**：两层 `width: max-content` 互相参照会把内部 `width: 100%` 算成 0，而思维导图组件「没尺寸就等 ResizeObserver」，形成死锁且无报错——用 `min-width: 100%` 兜底解决。
- **关系双向反查**：库中只存声明方，反向关系读取时遍历全库现算；删除条目时收集被删子树全部 id，全库清理指向它们的引用。
- **local-first 降级策略**：File System Access API 只存文件句柄（handle），文件实体留在本地；不支持的浏览器自动降级 Base64。

## 后续规划 / 已知待补

- 补单元测试（Vitest 已配好，已有 13 例覆盖 aiConfig / mindMap，持续补充中）
- 把知识关系（前置 / 相关）喂给 AI 当上下文，让导图和对话更好地贴合知识结构
- 出构建产物或可演示链接，别只停在本机 `dev`
- 迁移 Tauri 桌面端（作为差异化亮点）
- 个人学习日志单独存放、不入库（已在 .gitignore 排除）

## 许可证

个人学习用途，未声明额外许可证。
