const buildCorsHeaders = (origin) => {
  const allowedOrigin = origin || "*";
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
  };
};

const jsonResponse = (data, status = 200, origin) => {
  return {
    statusCode: status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...buildCorsHeaders(origin),
    },
    body: JSON.stringify(data),
  };
};

const resolveArkEndpoint = (endpoint) => {
  if (!endpoint) return "";
  const trimmed = endpoint.replace(/\/+$/, "");
  if (trimmed.endsWith("/chat/completions")) return trimmed;
  if (trimmed.endsWith("/api/v3")) return `${trimmed}/chat/completions`;
  return trimmed;
};

exports.handler = async (event = {}, context = {}) => {
  const origin =
    event.headers?.Origin ||
    event.headers?.origin ||
    event.headers?.["x-origin"] ||
    "";

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: buildCorsHeaders(origin),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse({ message: "Method Not Allowed" }, 405, origin);
  }

  const apiKey = process.env.ARK_API_KEY || "";
  const endpoint = resolveArkEndpoint(process.env.ARK_ENDPOINT || "");
  const model = String(process.env.ARK_MODEL || "doubao-seed-1-6-lite-251015");

  if (!apiKey) {
    return jsonResponse({ message: "Missing ARK_API_KEY" }, 500, origin);
  }
  if (!endpoint) {
    return jsonResponse({ message: "Missing ARK_ENDPOINT" }, 500, origin);
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch (error) {
    return jsonResponse({ message: "Invalid JSON body" }, 400, origin);
  }

  const text = String(payload.text || "").trim();
  if (!text) {
    return jsonResponse({ message: "Text is required" }, 400, origin);
  }

  const systemPrompt = String(payload.systemPrompt || "");

  try {
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
        data?.error?.message || data?.message || "Ark request failed";
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
};
