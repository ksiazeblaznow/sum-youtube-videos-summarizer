// Service worker: the ONLY component that holds API keys or calls LLMs.
// Content scripts message in; keys never leave here.

import { generate } from "./backends/adapter.js";

// Mirror of lib/settings.js defaults (this module can't import the classic script).
const DEFAULT_SETTINGS = {
  backend: "localhost",
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  openrouterApiKey: "",
  openrouterModel: "google/gemini-2.0-flash-exp:free",
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-6",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  localhostBaseUrl: "http://localhost:1234/v1",
  localhostModel: "local-model",
  localhostDisableThinking: true,
  language: "pl",
  wordLimit: 150,
  systemPrompt: ""
};

const DEFAULT_PROMPT = `You are an expert analyst. Summarize the video transcript provided by the user.
Rules:
1. Write the entire summary in this language: {{language}} — and ONLY that language. Do not translate or restate any text in another language.
2. Format with clean Markdown: one short overview sentence, then concise bullet points of the key takeaways. Bold the key terms.
3. Length is a SOFT target: aim for about {{wordLimit}} words. Never cut off mid-thought — prefer a complete idea over hitting the exact count.
4. Be objective, skip filler, and don't invent facts that aren't in the transcript.`;

const LANG_NAMES = {
  pl: "Polish", en: "English", de: "German", fr: "French", es: "Spanish",
  it: "Italian", uk: "Ukrainian", pt: "Portuguese", ru: "Russian", ja: "Japanese"
};

const REQUEST_TIMEOUT_MS = 60000;

function withCode(code, msg) { const e = new Error(msg); e.code = code; return e; }

function getSettings() { return chrome.storage.local.get(DEFAULT_SETTINGS); }

function buildPrompt(settings, title) {
  const tmpl = settings.systemPrompt && settings.systemPrompt.trim()
    ? settings.systemPrompt
    : DEFAULT_PROMPT;
  return tmpl
    .replace(/\{\{language\}\}/g, LANG_NAMES[settings.language] || settings.language)
    .replace(/\{\{wordLimit\}\}/g, String(settings.wordLimit))
    .replace(/\{\{title\}\}/g, title || "");
}

// Run one backend with its own timeout.
async function runBackend(backend, settings, systemPrompt, userContent) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await generate({ backend, systemPrompt, userContent, settings, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Cloud failures worth retrying on the local backend instead.
const FALLBACK_CODES = ["OVERLOADED", "RATE_LIMIT", "TIMEOUT", "BACKEND_UNREACHABLE"];

function requireKey(settings) {
  if (settings.backend === "gemini" && !settings.geminiApiKey) {
    throw withCode("NO_API_KEY", "Gemini API key not set");
  }
  if (settings.backend === "openrouter" && !settings.openrouterApiKey) {
    throw withCode("NO_API_KEY", "OpenRouter API key not set");
  }
  if (settings.backend === "anthropic" && !settings.anthropicApiKey) {
    throw withCode("NO_API_KEY", "Anthropic API key not set");
  }
  if (settings.backend === "openai" && !settings.openaiApiKey) {
    throw withCode("NO_API_KEY", "OpenAI API key not set");
  }
}

// Runs the selected backend, falling back to local LM Studio when a cloud backend is
// overloaded/unavailable (LM Studio JIT-loads the model named in settings, e.g. gemma).
async function generateWithFallback(settings, systemPrompt, userContent) {
  try {
    return { text: await runBackend(settings.backend, settings, systemPrompt, userContent) };
  } catch (e) {
    if (settings.backend !== "localhost" && FALLBACK_CODES.includes(e.code)) {
      console.warn(`[YTSum] ${settings.backend} failed (${e.code}); falling back to localhost…`);
      try {
        return { text: await runBackend("localhost", settings, systemPrompt, userContent), fallback: "localhost" };
      } catch (e2) {
        throw withCode(e2.code || "BACKEND_UNREACHABLE", `${settings.backend} ${e.code}; local fallback failed: ${e2.message}`);
      }
    }
    throw e;
  }
}

async function handleSummarize(req) {
  const settings = await getSettings();
  requireKey(settings);
  const systemPrompt = buildPrompt(settings, req.title);
  const userContent = `Video title: ${req.title || "(unknown)"}\n\nTranscript:\n${req.transcript}`;
  const { text, fallback } = await generateWithFallback(settings, systemPrompt, userContent);
  return { summary: text, fallback };
}

async function handleAsk(req) {
  const settings = await getSettings();
  requireKey(settings);
  const langName = LANG_NAMES[settings.language] || settings.language;
  const systemPrompt =
    `You are answering follow-up questions about a YouTube video, using ONLY the transcript provided. ` +
    `Respond exclusively in ${langName}. Do NOT translate, and do NOT restate your answer in any other language. ` +
    `Answer concisely in Markdown. If the answer is not in the transcript, say so plainly. ` +
    `Use the earlier conversation for context when a question is a follow-up.`;

  // Fold the last few turns into the prompt for multi-turn memory (keeps the adapter
  // interface single-string; the full transcript is already resent each turn).
  const history = (Array.isArray(req.history) ? req.history : []).slice(-6);
  const convo = history.map((h) => `Q: ${h.q}\nA: ${h.a}`).join("\n\n");

  const userContent =
    `Video title: ${req.title || "(unknown)"}\n\nTranscript:\n${req.transcript}` +
    (convo ? `\n\nEarlier in this conversation:\n${convo}` : "") +
    `\n\nNew question: ${req.question}`;

  const { text, fallback } = await generateWithFallback(settings, systemPrompt, userContent);
  return { answer: text, fallback };
}

async function handleTestBackend() {
  const settings = await getSettings();
  requireKey(settings);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    if (settings.backend === "localhost") {
      const base = (settings.localhostBaseUrl || "").replace(/\/$/, "");
      const r = await fetch(base + "/models", { signal: ctrl.signal });
      if (!r.ok) throw withCode("BACKEND_UNREACHABLE", `HTTP ${r.status}`);
    } else {
      await generate({
        backend: settings.backend,
        systemPrompt: "Reply with the single word OK.",
        userContent: "ping",
        settings,
        signal: ctrl.signal
      });
    }
    return { ok: true };
  } finally {
    clearTimeout(timer);
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === "summarizeVideo") {
    handleSummarize(req)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message, code: e.code || "BAD_RESPONSE" }));
    return true;
  }
  if (req.action === "askQuestion") {
    handleAsk(req)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message, code: e.code || "BAD_RESPONSE" }));
    return true;
  }
  if (req.action === "testBackend") {
    handleTestBackend()
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message, code: e.code || "BACKEND_UNREACHABLE" }));
    return true;
  }
  if (req.action === "openOptions") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return false;
  }
});
