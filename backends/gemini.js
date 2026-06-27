// Google Gemini Flash backend.

function gerr(code, msg) { const e = new Error(msg); e.code = code; return e; }

export async function generateGemini({ systemPrompt, userContent, settings, signal }) {
  const key = settings.geminiApiKey;
  if (!key) throw gerr("NO_API_KEY", "Missing Gemini API key");

  const model = settings.geminiModel || "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  const generationConfig = { temperature: 0.7, maxOutputTokens: 4096 };
  // gemini-2.5-* are "thinking" models: by default they can burn the output-token budget
  // on internal reasoning and return an empty answer. Disable thinking for summaries.
  if (/2\.5/.test(model)) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userContent }] }],
        generationConfig
      })
    });
  } catch (e) {
    if (e.name === "AbortError") throw gerr("TIMEOUT", "Request timed out");
    throw gerr("BACKEND_UNREACHABLE", e.message);
  }

  if (res.status === 401 || res.status === 403) throw gerr("AUTH", "Invalid or unauthorized API key");
  if (res.status === 429) throw gerr("RATE_LIMIT", "Rate limit exceeded");

  const data = await res.json().catch(() => null);
  if (res.status === 503 || data?.error?.status === "UNAVAILABLE") {
    throw gerr("OVERLOADED", data?.error?.message || "Model overloaded, try again later");
  }
  if (!res.ok) throw gerr("BAD_RESPONSE", data?.error?.message || `HTTP ${res.status}`);

  // Whole prompt rejected by safety filters?
  const block = data?.promptFeedback?.blockReason;
  if (block) throw gerr("BAD_RESPONSE", `Prompt blocked: ${block}`);

  const cand = data?.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .filter((p) => typeof p.text === "string" && !p.thought)
    .map((p) => p.text)
    .join("")
    .trim();

  if (!text) {
    const reason = cand?.finishReason || "UNKNOWN";
    console.error("[YTSum] Gemini returned no text. finishReason:", reason, "candidate:", cand);
    const hint = reason === "MAX_TOKENS"
      ? "hit token limit before answering"
      : reason === "SAFETY" || reason === "RECITATION"
        ? `blocked (${reason})`
        : reason;
    throw gerr("BAD_RESPONSE", `Empty response (${hint})`);
  }
  return text;
}
