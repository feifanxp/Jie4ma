# AI界四嘛

一个用于学习 AI 概念的网页工具。输入文本后自动识别 AI 与计算机相关术语，并在悬停时解释概念含义。

## 本地运行

1. 在项目目录设置环境变量（或修改 `.env`）：
   - `DEEPSEEK_API_KEY=你的Key`
2. 启动服务：
   - `npm start`
3. 打开浏览器访问：
   - `http://localhost:5173`

## 部署到 TOS（静态托管）

1. 设置后端服务地址（用于调用 API）：
   - 修改 `config.js` 的 `apiBase` 为你的后端地址
2. 构建静态文件：
   - `npm run build`
3. 将 `dist/` 整个目录上传到 TOS

## GitHub 自动部署到 TOS

推送到 `main` 后会自动构建并同步到 TOS。需要在 GitHub Secrets 配置：

- `TOS_ACCESS_KEY_ID`
- `TOS_SECRET_ACCESS_KEY`
- `TOS_BUCKET`
- `TOS_ENDPOINT`（示例：`https://tos-cn-beijing.volces.com`）
- `TOS_REGION`（示例：`cn-beijing`）
- `API_BASE`（后端服务地址，可留空）

## 说明

- 前端不保存 API Key，服务端通过环境变量读取。
- 服务端默认模型为 `deepseek-chat`，可通过 `DEEPSEEK_MODEL` 修改。
