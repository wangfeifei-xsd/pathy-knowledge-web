# pathy-knowledge-web

Karpathy 式知识库的 **Web 管理端**：对接同仓库下的 `pathy-knowledge-server`，在浏览器中管理 raw / wiki / schema 与模型配置等能力。

## 技术栈

- **React 19** + **TypeScript**
- **Vite 8**（开发与构建）
- **Ant Design 6** + **@ant-design/icons**
- **React Router 7**（路由）
- **Axios**（调用后端 REST）

## 后端与文档

接口、数据目录、环境变量与启动方式以服务端为准，请阅读：

**[pathy-knowledge-server README](https://github.com/wangfeifei-xsd/pathy-knowledge-server)**

本地开发时请先按该文档启动 API 服务，再在本目录执行 `npm install` 与 `npm run dev`。

## 页面与路由

| 路由 | 说明 |
|------|------|
| `/` | 配置摘要、快捷入口 |
| `/layers` | 三层存储（raw/wiki/schema 浏览、编辑、上传） |
| `/tasks/compile` | 编译任务 |
| `/tasks/lint` | 一致性报告 |
| `/tasks/polish` | 文本润色（`POST /api/v1/tasks/polish-text`） |
| `/knowledge-recall/nl` | 召回知识（BM25，仅召回） |
| `/knowledge-recall/dialogue-test` | 对话召回测试（召回 + LLM） |
| `/settings/llm` | 模型配置与连通性探测 |

开发时 Vite 将 `/api`、`/docs` 等代理到后端（见 `vite.config.ts`）；侧栏可填写与服务端 `API_KEY` 一致的 Bearer。
