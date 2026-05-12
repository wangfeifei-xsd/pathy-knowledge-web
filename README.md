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

### 应用根路径（`base`：默认 `/wiki/`）

与 **agent-plant-ui** 中 `base: '/agentplatform/'` 类似（静态资源挂在子路径），本前端默认 **`VITE_BASE=/wiki/`**（见 `vite.config.ts`）：构建产物在 **`wiki/`** 目录，部署到网关的 **`/wiki/`** 子路径后，访问形态为 **`https://<host>/wiki/#/`**、`#/layers` 等。

- **本地开发**：默认请打开 **`http://127.0.0.1:5173/wiki/`**（注意带 **`/wiki/`**）。
- **想挂在站点根路径**（`http://127.0.0.1:5173/`）：启动前设置环境变量 **`VITE_BASE=/`**（或空字符串会回退为默认 `/wiki/`，若需根路径请显式设为 `/`）。
- **构建输出目录**：默认 **`wiki/`**，可通过 **`VITE_OUT_DIR`** 覆盖（例如 `dist`）。

## 页面与路由

| 路由 | 说明 |
|------|------|
| `/` | 配置摘要、快捷入口 |
| `/layers` | 三层存储（raw/wiki/schema 浏览、编辑、上传；wiki 含嵌入状态与手动嵌入） |
| `/tasks/compile` | 编译任务 |
| `/tasks/lint` | 一致性报告 |
| `/tasks/polish` | 文本润色（`POST /api/v1/tasks/polish-text`） |
| `/knowledge-recall/nl` | 召回知识（BM25 + 向量双路召回，仅召回） |
| `/knowledge-recall/dialogue-test` | 对话召回测试（双路召回 + rerank + LLM） |
| `/settings/llm` | LLM 模型配置与连通性探测 |
| `/settings/embedding` | Embedding 模型配置与连通性探测 |
| `/settings/rerank` | Rerank 模型配置与连通性探测 |

开发时 Vite 将 `/api`、`/docs` 等代理到后端（见 `vite.config.ts`）。

## Windows 本地部署

在 Windows 项目目录中，使用系统自带 PowerShell 执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\start-web.ps1 -Port 5174 -ApiTarget "http://127.0.0.1:8766"
```

启动后浏览器访问前端地址（默认带 `/wiki/` 子路径）：`http://127.0.0.1:5174/wiki/`；若启动时指定了 `-Base /` 则为根路径 `http://127.0.0.1:5174/`。
