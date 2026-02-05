# AI界四嘛

一个用于学习 AI 概念的网页工具。输入文本后自动识别 AI 与计算机相关术语，并在悬停时解释概念含义。

## 本地运行

1. 在项目目录设置环境变量（或修改 `.env`）：
   - `DEEPSEEK_API_KEY=你的Key`
2. 启动服务：
   - `npm start`
3. 打开浏览器访问：
   - `http://localhost:5173`

## 说明

- 前端不保存 API Key，服务端通过环境变量读取。
- 服务端默认模型为 `deepseek-chat`，可通过 `DEEPSEEK_MODEL` 修改。
