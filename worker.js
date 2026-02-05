const buildCorsHeaders = (origin) => {
  const allowedOrigin = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
};

const jsonResponse = (data, status = 200, origin) => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...buildCorsHeaders(origin),
    },
  });
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: buildCorsHeaders(origin) });
    }

    if (url.pathname !== "/api/analyze") {
      return jsonResponse({ message: "Not Found" }, 404, origin);
    }

    if (request.method !== "POST") {
      return jsonResponse({ message: "Method Not Allowed" }, 405, origin);
    }

    if (!env.DEEPSEEK_API_KEY) {
      return jsonResponse({ message: "Missing DEEPSEEK_API_KEY" }, 500, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch (error) {
      return jsonResponse({ message: "Invalid JSON body" }, 400, origin);
    }

    const text = String(payload.text || "").trim();
    if (!text) {
      return jsonResponse({ message: "Text is required" }, 400, origin);
    }

    const model = String(payload.model || "deepseek-chat").trim();
    const systemPrompt = String(payload.systemPrompt || "");

    try {
      const response = await fetch(
        "https://api.deepseek.com/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: text },
            ],
            temperature: 0.2,
          }),
        }
      );

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          data?.error?.message || data?.message || "DeepSeek request failed";
        return jsonResponse(
          { message: errorMessage, status: response.status },
          response.status,
          origin
        );
      }

      return jsonResponse(data, 200, origin);
    } catch (error) {
      return jsonResponse(
        { message: `Upstream error: ${error.message}` },
        502,
        origin
      );
    }
  },
};
