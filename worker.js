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

    const systemPrompt = String(payload.systemPrompt || "");
    const provider = String(env.PROVIDER || "deepseek").toLowerCase();

    try {
      let endpoint = "";
      let apiKey = "";
      let model = "";

      if (provider === "openai") {
        endpoint = "https://api.openai.com/v1/chat/completions";
        apiKey = env.OPENAI_API_KEY || "";
        model = String(env.OPENAI_MODEL || payload.model || "gpt-4o-mini").trim();
      } else {
        endpoint = "https://api.deepseek.com/chat/completions";
        apiKey = env.DEEPSEEK_API_KEY || "";
        model = String(env.DEEPSEEK_MODEL || payload.model || "deepseek-chat").trim();
      }

      if (!apiKey) {
        const keyName = provider === "openai" ? "OPENAI_API_KEY" : "DEEPSEEK_API_KEY";
        return jsonResponse({ message: `Missing ${keyName}` }, 500, origin);
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: text },
          ],
          temperature: 0.2,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage =
          data?.error?.message || data?.message || "Upstream request failed";
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
