# My Knowledge Assistant

这是一个以 Vue 3 + Vite 为基础的个人知识管理助手，适合用于学习笔记整理、知识库管理、AI 问答、思维导图生成以及项目进度追踪。

## 功能概览

- 知识库管理：新增、删除、分类和维护学习内容
- AI 对话：结合知识库内容生成上下文提示，支持流式回答
- 思维导图：基于知识库内容生成脑图结构
- PDF 阅读：上传并浏览 PDF 文件，支持页面切换与标注
- 项目管理：创建项目、维护任务节点、记录进度和附件

## 技术栈

- Vue 3
- Vite
- TypeScript
- Pinia
- Vue Router
- pdfjs-dist
- simple-mind-map
- DeepSeek / OpenAI 兼容接口

## 项目结构

```text
my-knowledge-assistant/
├── src/
│   ├── components/      # 通用组件
│   ├── services/        # AI / PDF / 思维导图服务
│   ├── stores/          # Pinia 状态管理
│   ├── views/           # 页面视图
│   ├── router/          # 路由配置
│   ├── types/           # 类型定义
│   ├── App.vue
│   └── main.ts
├── public/
├── package.json
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件，并加入以下配置：

```env
VITE_API_BASE=https://api.deepseek.com
VITE_AI_API_KEY=your_api_key_here
VITE_AI_MODEL=deepseek-v4-flash
```

说明：
- `VITE_AI_API_KEY` 为你的 AI 接口密钥
- `VITE_API_BASE` 可改为兼容 OpenAI API 格式的其他地址
- `VITE_AI_MODEL` 可按需替换为可用模型名称

### 3. 启动开发服务器

```bash
npm run dev
```

默认地址通常为：

```text
http://localhost:5173
```

## 可用脚本

```bash
npm run dev        # 本地开发
npm run build      # 生产构建
npm run preview    # 预览生产构建
npm run test:unit  # 运行 Vitest 测试
npm run lint       # 运行 ESLint / Oxlint 检查
npm run format     # 格式化代码
```

## AI 对话配置说明

项目中的 AI 接口位于 `src/services/ai.ts`，默认使用 DeepSeek 的 Chat Completions API，支持流式输出，适合聊天场景的逐段显示。

在调用前，确保已经在环境变量中设置了有效的 `VITE_AI_API_KEY`，否则会收到配置错误提示。

## 典型使用流程

1. 在“知识库”页面添加学习主题和描述
2. 进入“AI 对话”页面，结合知识库内容提问
3. 在“思维导图”页面生成结构化脑图
4. 在“PDF 阅读”页面上传学习资料并做标注
5. 在“项目进度”页面管理学习任务和节点

## 备注

- 本项目适合个人学习和知识沉淀场景
- 若你使用的是非 DeepSeek 的 API 服务，需同步调整 `VITE_API_BASE` 和模型名称
- 若需要扩展更多功能，可以在 `src/services` 和 `src/stores` 中继续补充能力

## 许可证

本项目仅用于个人学习与知识管理场景，未声明额外许可证。
