const analyzeBtn = document.getElementById("analyzeBtn");
const clearBtn = document.getElementById("clearBtn");
const inputText = document.getElementById("inputText");
const output = document.getElementById("output");
const statusText = document.getElementById("status");
const tooltip = document.getElementById("tooltip");
const savedList = document.getElementById("savedList");
const savedEmpty = document.getElementById("savedEmpty");

const SAMPLE_TEXT =
  "总体建议：采用“人机协作 + 语义向量”体系，20 万字段属于中等规模。最适合采用 embedding 语义聚类 + LLM 辅助命名 + 人工校对。多层级结构可通过聚类树生成。";

const savedTerms = new Map();
const COOKIE_KEY = "saved_terms";
const COOKIE_MAX_DAYS = 365;

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
  "4) 给出分类 category，短语即可，例如：模型/算法/数据/工程/应用/评估/其他。",
  "5) definition 用简体中文，控制在 40 字以内。",
].join("\n");

const resolveApiUrl = () => {
  const apiBase = window.APP_CONFIG?.apiBase || "";
  const trimmed = apiBase.replace(/\/+$/, "");
  if (!trimmed) return "/api/analyze";
  return `${trimmed}/api/analyze`;
};

const API_URL = resolveApiUrl();

const setStatus = (message, type = "info") => {
  statusText.textContent = message;
  statusText.dataset.type = type;
};

const setLoading = (loading) => {
  analyzeBtn.disabled = loading;
  analyzeBtn.textContent = loading ? "分析中..." : "分析并高亮";
};

const readCookie = (name) => {
  const prefix = `${name}=`;
  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const item of cookies) {
    if (item.startsWith(prefix)) {
      return decodeURIComponent(item.slice(prefix.length));
    }
  }
  return "";
};

const writeCookie = (name, value, maxDays) => {
  const maxAge = Math.max(0, Math.floor(maxDays * 24 * 60 * 60));
  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
};

const persistSavedTerms = () => {
  if (!savedTerms.size) {
    writeCookie(COOKIE_KEY, "", 0);
    return;
  }
  const payload = JSON.stringify(Array.from(savedTerms.values()));
  writeCookie(COOKIE_KEY, payload, COOKIE_MAX_DAYS);
};

const loadSavedTerms = () => {
  const raw = readCookie(COOKIE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    parsed.forEach((item) => {
      if (!item || typeof item.term !== "string") return;
      const term = item.term.trim();
      if (!term) return;
      savedTerms.set(term, {
        term,
        definition: String(item.definition || "").trim(),
        category: String(item.category || "其他").trim() || "其他",
      });
    });
  } catch (error) {
    writeCookie(COOKIE_KEY, "", 0);
  }
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
      category: item.category,
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
    const catText = escapeHtml(match.category || "其他");
    parts.push(
      `<span class="term" data-definition="${defText}" data-category="${catText}" data-term="${termText}">${termText}</span>`
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
        item &&
        typeof item.term === "string" &&
        typeof item.definition === "string"
    )
    .map((item) => ({
      term: item.term.trim(),
      definition: item.definition.trim(),
      category: String(item.category || "其他").trim(),
    }))
    .filter((item) => item.term.length > 0 && item.definition.length > 0);
};

const renderSavedTerms = () => {
  savedList.innerHTML = "";
  const terms = Array.from(savedTerms.values());
  if (!terms.length) {
    savedEmpty.style.display = "block";
    return;
  }
  savedEmpty.style.display = "none";
  for (const item of terms) {
    const card = document.createElement("div");
    card.className = "saved-card";
    card.innerHTML = `
      <div class="saved-title">
        <span class="saved-term">${escapeHtml(item.term)}</span>
        <div class="saved-actions">
          <span class="saved-badge">${escapeHtml(item.category || "其他")}</span>
          <button class="saved-remove" type="button" data-term="${escapeHtml(
            item.term
          )}">删除</button>
        </div>
      </div>
      <p class="saved-desc">${escapeHtml(item.definition)}</p>
    `;
    savedList.appendChild(card);
  }
};

const analyzeText = async () => {
  let text = inputText.value.trim();

  output.innerHTML = "";
  if (!text) {
    text = SAMPLE_TEXT;
    inputText.value = text;
    setStatus("已使用示例文本进行解析。", "info");
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

    const responseText = await response.text();
    let responseJson = null;
    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      responseJson = null;
    }

    if (!response.ok) {
      const errorMessage =
        responseJson?.error?.message ||
        responseJson?.message ||
        responseText ||
        "未知错误";
      throw new Error(`API 请求失败：${response.status} ${errorMessage}`);
    }

    const data = responseJson;
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
  savedTerms.clear();
  persistSavedTerms();
  renderSavedTerms();
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

output.addEventListener("click", (event) => {
  const target = event.target;
  if (!target.classList.contains("term")) return;
  const term = target.dataset.term || target.textContent.trim();
  const definition = target.dataset.definition || "";
  const category = target.dataset.category || "其他";
  if (!term) return;
  if (!savedTerms.has(term)) {
    savedTerms.set(term, { term, definition, category });
    persistSavedTerms();
    renderSavedTerms();
  }
});

savedList.addEventListener("click", (event) => {
  const target = event.target;
  if (!target.classList.contains("saved-remove")) return;
  const term = target.dataset.term;
  if (!term || !savedTerms.has(term)) return;
  savedTerms.delete(term);
  persistSavedTerms();
  renderSavedTerms();
});

loadSavedTerms();
renderSavedTerms();
