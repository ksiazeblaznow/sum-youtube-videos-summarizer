// Options page logic. Uses DEFAULT_SETTINGS / loadSettings (lib/settings.js) and t (i18n.js).

const FIELDS = [
  "backend", "geminiApiKey", "geminiModel",
  "openrouterApiKey", "openrouterModel",
  "anthropicApiKey", "anthropicModel",
  "openaiApiKey", "openaiModel",
  "localhostBaseUrl", "localhostModel", "localhostDisableThinking",
  "language", "wordLimit", "systemPrompt"
];

const $ = (id) => document.getElementById(id);
let uiLang = "pl";

function applyI18n() {
  document.documentElement.lang = uiLang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n, uiLang);
  });
}

function toggleBackendGroups() {
  const b = $("backend").value;
  $("group-gemini").style.display = b === "gemini" ? "" : "none";
  $("group-openrouter").style.display = b === "openrouter" ? "" : "none";
  $("group-anthropic").style.display = b === "anthropic" ? "" : "none";
  $("group-openai").style.display = b === "openai" ? "" : "none";
  $("group-localhost").style.display = b === "localhost" ? "" : "none";
}

function setStatus(msg, kind) {
  const el = $("status");
  el.textContent = msg;
  el.className = kind || "";
  if (msg) setTimeout(() => { el.textContent = ""; el.className = ""; }, 4000);
}

async function restore() {
  const s = await loadSettings();
  uiLang = s.language || "pl";
  FIELDS.forEach((k) => {
    const el = $(k);
    if (!el) return;
    if (el.type === "checkbox") el.checked = !!s[k];
    else el.value = s[k];
  });
  applyI18n();
  toggleBackendGroups();
}

function collect() {
  const out = {};
  FIELDS.forEach((k) => {
    const el = $(k);
    if (el.type === "checkbox") { out[k] = el.checked; return; }
    let v = el.value;
    if (k === "wordLimit") v = parseInt(v, 10) || DEFAULT_SETTINGS.wordLimit;
    out[k] = v;
  });
  return out;
}

// Persist immediately on any edit so nothing is lost when switching backends or when the
// popup closes on blur. The Save button just gives explicit confirmation.
let autosaveTimer = null;
function autosave() {
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => { chrome.storage.local.set(collect()); }, 300);
}

async function save() {
  const settings = collect();
  await chrome.storage.local.set(settings);
  uiLang = settings.language || "pl";
  applyI18n();
  setStatus(t("opt.saved", uiLang), "ok");
}

async function test() {
  await chrome.storage.local.set(collect()); // test what's on screen
  setStatus("…", "");
  const resp = await chrome.runtime.sendMessage({ action: "testBackend" });
  if (resp && resp.ok) setStatus(t("opt.testOk", uiLang), "ok");
  else setStatus(`${t("opt.testFail", uiLang)} (${resp?.code || "?"})`, "err");
}

document.addEventListener("DOMContentLoaded", () => {
  restore();

  // Auto-save every field on edit.
  FIELDS.forEach((k) => {
    const el = $(k);
    if (el) { el.addEventListener("input", autosave); el.addEventListener("change", autosave); }
  });

  $("backend").addEventListener("change", toggleBackendGroups);
  $("save").addEventListener("click", save);
  $("test").addEventListener("click", test);
  $("resetPrompt").addEventListener("click", () => { $("systemPrompt").value = ""; autosave(); });
  const toggleVisibility = (input) => () => { input.type = input.type === "password" ? "text" : "password"; };
  $("toggleKey").addEventListener("click", toggleVisibility($("geminiApiKey")));
  $("toggleKeyOr").addEventListener("click", toggleVisibility($("openrouterApiKey")));
  $("toggleKeyAn").addEventListener("click", toggleVisibility($("anthropicApiKey")));
  $("toggleKeyOa").addEventListener("click", toggleVisibility($("openaiApiKey")));
  $("language").addEventListener("change", () => { uiLang = $("language").value; applyI18n(); });
});
