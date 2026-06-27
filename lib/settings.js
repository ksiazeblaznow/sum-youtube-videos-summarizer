// Shared settings defaults + loader (classic script; used by content scripts and options page).
// The service worker (background.js, an ES module) keeps its own copy of these defaults.

const DEFAULT_SETTINGS = {
  backend: "openrouter",          // "localhost" | "gemini" | "openrouter" | "anthropic" | "openai"
  geminiApiKey: "",
  geminiModel: "gemini-2.5-flash",
  openrouterApiKey: "",
  openrouterModel: "google/gemma-4-31b-it:free",
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-6",
  openaiApiKey: "",
  openaiModel: "gpt-4o-mini",
  localhostBaseUrl: "http://localhost:1234/v1",
  localhostModel: "google/gemma-3-4b",
  localhostDisableThinking: true,   // suppress reasoning on local models
  language: "pl",                // UI + summary language; default Polish
  wordLimit: 250,                // soft limit (prompt-enforced)
  systemPrompt: ""               // "" => use the built-in localized default
};

// Returns stored settings merged over defaults. API key lives in storage.local only.
async function loadSettings() {
  return chrome.storage.local.get(DEFAULT_SETTINGS);
}
