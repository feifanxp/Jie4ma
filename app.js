const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const inputText = document.getElementById("inputText");
const output = document.getElementById("output");
const statusText = document.getElementById("status");
const tooltip = document.getElementById("tooltip");

const SYSTEM_PROMPT = [
  "你是一个教学助手。",
  "请从用户文本中识别 AI 名词与计算机相关概念。",
  "返回 JSON，格式严格如下：",
  "{",
  '  "terms": [',
  '    {"term": "概念词", "definition": "简明解释，包含作用或意义"}',
  "  ]",
  "}",
  "要求：",
  "1) 只返回 JSON，不要额外解释。",
  "2) term 必须出现在原文中，保持原文的大小写与写法。",
  "3) 优先识别 AI/ML/计算机术语或缩写（如 LLM、RAG、embedding）。",
  "4) definition 用简体中文，控制在 40 字以内。",
].join("\n");

const API_URL = "/api/analyze";

const setStatus = (message, type = "info") => {
  statusText.textContent = message;
  statusText.dataset.type = type;
};

const setLoading = (loading) => {
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? "分析中..." : "分析并高亮";
};

const escapeHtml = (value) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const findAllMatches = (text, term) => {
  const matches = [];
  if (!term) return matches;
  let startIndex = 0;
  while (startIndex < text.length) {
    const index = text.indexOf(term, startIndex);
    if (index === -1) break;
    matches.push({ start: index, end: index + term.length, term });
    startIndex = index + term.length;
  }
  return matches;
};

const buildHighlightHtml = (text, terms) => {
  if (!terms.length) return escapeHtml(text);

  const allMatches = terms.flatMap((item) =>
    findAllMatches(text, item.term).map((match) => ({
      ...match,
      definition: item.definition,
    }))
  );

  if (!allMatches.length) return escapeHtml(text);

  allMatches.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - a.end;
  });

  const merged = [];
  let lastEnd = -1;
  for (const match of allMatches) {
    if (match.start >= lastEnd) {
      merged.push(match);
      lastEnd = match.end;
    }
  }

  let cursor = 0;
  const parts = [];
  for (const match of merged) {
    if (cursor < match.start) {
      parts.push(escapeHtml(text.slice(cursor, match.start)));
    }
    const termText = escapeHtml(text.slice(match.start, match.end));
    const defText = escapeHtml(match.definition);
    parts.push(
      `<span class="term" data-definition="${defText}">${termText}</span>`
    );
    cursor = match.end;
  }
  if (cursor < text.length) {
    parts.push(escapeHtml(text.slice(cursor)));
  }
  return parts.join("");
};

const parseTermsFromResponse = (data) => {
  const outputText = data?.choices?.[0]?.message?.content || "";
  if (!outputText) return [];

  const tryParse = (value) => {
    try {
      return JSON.parse(value);
    } catch (error) {
      return null;
    }
  };

  let parsed = tryParse(outputText);
  if (!parsed) {
    const match = outputText.match(/\{[\s\S]*\}/);
    if (match) {
      parsed = tryParse(match[0]);
    }
  }

  if (!parsed || !Array.isArray(parsed.terms)) return [];

  return parsed.terms
    .filter(
      (item) =>
        item && typeof item.term === "string" && typeof item.definition === "string"
    )
    .map((item) => ({
      term: item.term.trim(),
      definition: item.definition.trim(),
    }))
    .filter((item) => item.term.length > 0 && item.definition.length > 0);
};

const analyzeText = async () => {
  const text = inputText.value.trim();

  output.innerHTML = "";
  if (!text) {
    setStatus("请输入需要分析的文本。", "warn");
    return;
  }

  setLoading(true);
  setStatus("正在调用服务进行分析...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        systemPrompt: SYSTEM_PROMPT,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(async () => {
        const errorText = await response.text();
        return { message: errorText };
      });
      const errorMessage =
        errorBody?.error?.message || errorBody?.message || "未知错误";
      throw new Error(`API 请求失败：${response.status} ${errorMessage}`);
    }

    const data = await response.json();
    const terms = parseTermsFromResponse(data);

    if (!terms.length) {
      output.textContent = text;
      setStatus("未找到可识别的概念，已返回原文。", "info");
      return;
    }

    output.innerHTML = buildHighlightHtml(text, terms);
    setStatus(`已识别 ${terms.length} 个概念，悬停查看解释。`, "success");
  } catch (error) {
    output.textContent = text;
    if (String(error.message).includes("Failed to fetch")) {
      setStatus(
        "分析失败：无法连接本地服务，请先启动 server.js。",
        "error"
      );
    } else {
      setStatus(`分析失败：${error.message}`, "error");
    }
  } finally {
    setLoading(false);
  }
};

const clearAll = () => {
  inputText.value = "";
  output.innerHTML = "";
  setStatus("");
};

const showTooltip = (event) => {
  const target = event.target;
  if (!target.classList.contains("term")) return;
  const definition = target.dataset.definition;
  tooltip.textContent = definition;
  tooltip.setAttribute("aria-hidden", "false");
  tooltip.classList.add("visible");
  positionTooltip(event);
};

const hideTooltip = () => {
  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
};

const positionTooltip = (event) => {
  const padding = 12;
  const { clientX, clientY } = event;
  const tooltipRect = tooltip.getBoundingClientRect();
  let x = clientX + padding;
  let y = clientY + padding;

  if (x + tooltipRect.width > window.innerWidth) {
    x = clientX - tooltipRect.width - padding;
  }
  if (y + tooltipRect.height > window.innerHeight) {
    y = clientY - tooltipRect.height - padding;
  }

  tooltip.style.left = `${Math.max(padding, x)}px`;
  tooltip.style.top = `${Math.max(padding, y)}px`;
};

analyzeBtn.addEventListener("click", analyzeText);
clearBtn.addEventListener("click", clearAll);

output.addEventListener("mouseover", showTooltip);
output.addEventListener("mousemove", positionTooltip);
output.addEventListener("mouseout", hideTooltip);
