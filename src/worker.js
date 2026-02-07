const API_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

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

const jsonResponse = (payload, status = 200, cors = true) => {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
  };
  if (cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return new Response(JSON.stringify(payload), { status, headers });
};

const textResponse = (text, status = 200, cors = true) => {
  const headers = { "Content-Type": "text/plain; charset=utf-8" };
  if (cors) {
    headers["Access-Control-Allow-Origin"] = "*";
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Content-Type";
  }
  return new Response(text, { status, headers });
};

const handleAnalyze = async (request, env) => {
  if (!env.DEEPSEEK_API_KEY) {
    return jsonResponse({ message: "缺少 DEEPSEEK_API_KEY 环境变量" }, 500);
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return jsonResponse({ message: "请求体不是合法 JSON" }, 400);
  }

  const text = String(payload?.text || "").trim();
  const systemPrompt = String(payload?.systemPrompt || DEFAULT_PROMPT);

  if (!text) {
    return jsonResponse({ message: "文本不能为空" }, 400);
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.DEEPSEEK_MODEL || DEFAULT_MODEL,
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
      return jsonResponse({ message: errorMessage }, response.status);
    }

    const data = await response.json();
    return jsonResponse(data, 200);
  } catch (error) {
    return jsonResponse({ message: `服务异常：${error.message}` }, 500);
  }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return textResponse("", 204);
    }

    if (request.method === "POST" && url.pathname.startsWith("/api/analyze")) {
      return handleAnalyze(request, env);
    }

    return textResponse("Not Found", 404);
  },
};
