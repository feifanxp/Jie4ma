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

## 火山函数计算后端（国内可直连）

适用于国内网络环境，作为 `/api/analyze` 代理。

### 函数代码

见 `volc-fc/index.js`，采用 Node.js 运行时。

### 环境变量

- `ARK_API_KEY`：方舟 API Key（必填）
- `ARK_ENDPOINT`：方舟 OpenAI 兼容接口地址  
  推荐完整地址：`https://ark.cn-beijing.volces.com/api/v3/chat/completions`
- `ARK_MODEL`：默认 `doubao-seed-1-6-lite-251015`

### 接入前端

把 Cloudflare Pages 的 Build command 改为：

`echo "window.APP_CONFIG={apiBase:'https://<你的函数网关域名>'};" > config.js && npm run build`

## 本地脚本自动更新函数代码（Volcengine SDK）

该脚本使用官方 SDK 进行 OpenAPI 调用，更新函数代码来源（TOS）。

### 1) 准备配置

复制配置模板并填写：

```
cp volc-fc/deploy-config.json.example volc-fc/deploy-config.json
```

需要填写的字段：

- `ServiceName`：函数服务名
- `FunctionName`：函数名
- `SourceLocation`：TOS 代码包地址（示例 `tos://bucket/path.zip`）
- `version`：UpdateFunction API 版本（以控制台文档为准）

### 2) 设置环境变量

```
export VOLC_ACCESSKEY=你的AK
export VOLC_SECRETKEY=你的SK
```

### 3) 执行更新

```
npm run deploy:volc
```

> 说明：当前脚本会读取 `volc-fc/deploy-config.json`，并通过 OpenAPI 调用更新函数。
