require("dotenv").config();
const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = Number(process.env.PORT || 5173);
const API_KEY = process.env.DEEPSEEK_API_KEY;
const API_URL = "https://api.deepseek.com/chat/completions";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const PUBLIC_DIR = __dirname;

const DEFAULT_PROMPT = [
  "你是一个教学助手。",
  "请从用户文本中识别 AI 名词与计算机相关概念。",
  "只返回 JSON，格式严格如下：",
  "{",
  '  "terms": [',
  '    {"term": "概念词", "definition": "简明解释，包含作用或意义"}',
  "  ]",
  "}",
  "要求：",
  "1) term 必须出现在原文中，保持原文的大小写与写法。",
  "2) 优先识别 AI/ML/计算机术语或缩写（如 LLM、RAG、embedding）。",
  "3) definition 用简体中文，控制在 40 字以内。",
].join("\n");

const sendJson = (res, status, payload) => {
  const data = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
  });
  res.end(data);
};

const sendText = (res, status, text) => {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
  });
  res.end(text);
};

const getContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    default:
      return "application/octet-stream";
  }
};

const serveStatic = (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(requestUrl.pathname);
  if (pathname === "/") pathname = "/index.html";

  const filePath = path.join(PUBLIC_DIR, pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendText(res, 404, "Not Found");
      return;
    }
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    res.end(data);
  });
};

const handleAnalyze = async (req, res) => {
  if (!API_KEY) {
    sendJson(res, 500, { message: "缺少 DEEPSEEK_API_KEY 环境变量" });
    return;
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (error) {
      sendJson(res, 400, { message: "请求体不是合法 JSON" });
      return;
    }

    const text = String(payload.text || "").trim();
    const systemPrompt = String(payload.systemPrompt || DEFAULT_PROMPT);

    if (!text) {
      sendJson(res, 400, { message: "文本不能为空" });
      return;
    }

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          temperature: 0.2,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(async () => {
          const errorText = await response.text();
          return { message: errorText };
        });
        const errorMessage =
          errorBody?.error?.message || errorBody?.message || "未知错误";
        sendJson(res, response.status, { message: errorMessage });
        return;
      }

      const data = await response.json();
      sendJson(res, 200, data);
    } catch (error) {
      sendJson(res, 500, { message: `服务异常：${error.message}` });
    }
  });
};

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url.startsWith("/api/analyze")) {
    handleAnalyze(req, res);
    return;
  }
  if (req.method === "GET") {
    serveStatic(req, res);
    return;
  }
  sendText(res, 405, "Method Not Allowed");
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
