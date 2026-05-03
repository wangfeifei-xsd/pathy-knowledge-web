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
