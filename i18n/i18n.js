// Simple user-selectable i18n (classic script). Defines globals `I18N` and `t`.
// Language is driven by the user setting (default "pl"), not the browser locale.

const I18N = {
  pl: {
    summarize: "Podsumuj",
    summarizing: "Przetwarzanie…",
    panelTitle: "Podsumowanie",
    fetchingTranscript: "Szukam transkrypcji…",
    loading: "Generuję podsumowanie…",
    copy: "Kopiuj",
    copied: "Skopiowano!",
    rerun: "Wygeneruj ponownie",
    settings: "Ustawienia",
    close: "Zamknij",
    askPlaceholder: "Zapytaj o to wideo…",
    fallbackNote: "Gemini przeciążony — wygenerowano lokalnie.",
    errors: {
      NO_TRANSCRIPT: "To wideo nie ma dostępnej transkrypcji.",
      BACKEND_UNREACHABLE: "Nie można połączyć się z backendem AI. Sprawdź ustawienia / czy serwer działa.",
      AUTH: "Błąd uwierzytelniania — sprawdź klucz API w ustawieniach.",
      RATE_LIMIT: "Przekroczono limit zapytań. Spróbuj ponownie za chwilę.",
      TIMEOUT: "Przekroczono czas oczekiwania na odpowiedź.",
      BAD_RESPONSE: "Backend zwrócił nieprawidłową odpowiedź.",
      NO_API_KEY: "Brak klucza API. Uzupełnij go w ustawieniach.",
      CONTEXT_STALE: "Rozszerzenie zostało przeładowane — odśwież stronę (F5).",
      GENERIC: "Wystąpił nieoczekiwany błąd."
    },
    opt: {
      title: "YT Summarizer — ustawienia",
      backend: "Backend AI",
      backendLocalhost: "Lokalny (LM Studio)",
      backendGemini: "Chmura (Google Gemini)",
      backendAnthropic: "Chmura (Anthropic Claude)",
      backendOpenai: "Chmura (OpenAI ChatGPT)",
      backendOpenrouter: "Chmura (OpenRouter)",
      geminiKey: "Klucz API Gemini",
      geminiModel: "Model Gemini",
      openrouterKey: "Klucz API OpenRouter",
      openrouterModel: "Model OpenRouter",
      anthropicKey: "Klucz API Anthropic",
      anthropicModel: "Model Anthropic",
      openaiKey: "Klucz API OpenAI",
      openaiModel: "Model OpenAI",
      openrouterHint: "Pełny identyfikator modelu z openrouter.ai/models, np. google/gemini-2.0-flash-exp:free",
      localhostUrl: "Adres serwera (base URL)",
      localhostModel: "Nazwa modelu",
      disableThinking: "Wyłącz myślenie / rozumowanie (Thinking/Reasoning)",
      language: "Język podsumowania",
      wordLimit: "Miękki limit słów",
      systemPrompt: "Prompt systemowy (puste = domyślny)",
      reset: "Przywróć domyślny",
      save: "Zapisz",
      test: "Testuj połączenie",
      saved: "Zapisano!",
      testOk: "Połączenie OK ✓",
      testFail: "Błąd połączenia",
      keyHint: "Klucz jest przechowywany lokalnie (storage.local) i nie jest synchronizowany.",
      promptHint: "Dostępne znaczniki: {{language}}, {{wordLimit}}, {{title}}"
    }
  },
  en: {
    summarize: "Summarize",
    summarizing: "Processing…",
    panelTitle: "Summary",
    fetchingTranscript: "Fetching transcript…",
    loading: "Generating summary…",
    copy: "Copy",
    copied: "Copied!",
    rerun: "Regenerate",
    settings: "Settings",
    close: "Close",
    askPlaceholder: "Ask about this video…",
    fallbackNote: "Gemini overloaded — generated locally instead.",
    errors: {
      NO_TRANSCRIPT: "This video has no available transcript.",
      BACKEND_UNREACHABLE: "Can't reach the AI backend. Check settings / that the server is running.",
      AUTH: "Authentication error — check the API key in settings.",
      RATE_LIMIT: "Rate limit exceeded. Try again shortly.",
      TIMEOUT: "Timed out waiting for a response.",
      BAD_RESPONSE: "The backend returned an invalid response.",
      NO_API_KEY: "Missing API key. Add it in settings.",
      CONTEXT_STALE: "The extension was reloaded — refresh the page (F5).",
      GENERIC: "An unexpected error occurred."
    },
    opt: {
      title: "YT Summarizer — settings",
      backend: "AI backend",
      backendLocalhost: "Local (LM Studio)",
      backendGemini: "Cloud (Google Gemini)",
      backendAnthropic: "Cloud (Anthropic Claude)",
      backendOpenai: "Cloud (OpenAI ChatGPT)",
      backendOpenrouter: "Cloud (OpenRouter)",
      geminiKey: "Gemini API key",
      geminiModel: "Gemini model",
      openrouterKey: "OpenRouter API key",
      openrouterModel: "OpenRouter model",
      anthropicKey: "Anthropic API key",
      anthropicModel: "Anthropic model",
      openaiKey: "OpenAI API key",
      openaiModel: "OpenAI model",
      openrouterHint: "Full model ID from openrouter.ai/models, e.g. google/gemini-2.0-flash-exp:free",
      localhostUrl: "Server base URL",
      localhostModel: "Model name",
      disableThinking: "Disable thinking / reasoning",
      language: "Summary language",
      wordLimit: "Soft word limit",
      systemPrompt: "System prompt (empty = default)",
      reset: "Reset to default",
      save: "Save",
      test: "Test connection",
      saved: "Saved!",
      testOk: "Connection OK ✓",
      testFail: "Connection failed",
      keyHint: "The key is stored locally (storage.local) and is not synced.",
      promptHint: "Available placeholders: {{language}}, {{wordLimit}}, {{title}}"
    }
  }
};

function t(key, lang) {
  const l = I18N[lang] ? lang : "en";
  const fromLang = key.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), I18N[l]);
  if (fromLang != null) return fromLang;
  const fromEn = key.split(".").reduce((o, k) => (o && o[k] != null ? o[k] : null), I18N.en);
  return fromEn != null ? fromEn : key;
}
