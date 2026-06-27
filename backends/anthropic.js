// Anthropic (Claude) backend — Messages API (/v1/messages).
// Distinct shape from OpenAI: `system` is a top-level field, the answer lives in
// data.content[] text blocks, and browser/extension-origin requests require the
// `anthropic-dangerous-direct-browser-access` header (host_permissions exempt the SW
// fetch from CORS preflight; this header is what lets Anthropic accept the origin).

function aerr(code, msg) { const e = new Error(msg); e.code = code; return e; }

export async function generateAnthropic({ systemPrompt, userContent, settings, signal }) {
  const key = settings.anthropicApiKey;
  if (!key) throw aerr("NO_API_KEY", "Missing Anthropic API key");

  const model = settings.anthropicModel || "claude-sonnet-4-6";

  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }]
      })
    });
  } catch (e) {
    if (e.name === "AbortError") throw aerr("TIMEOUT", "Request timed out");
    throw aerr("BACKEND_UNREACHABLE", e.message);
  }

  if (res.status === 401 || res.status === 403) throw aerr("AUTH", "Invalid or unauthorized API key");
  if (res.status === 429) throw aerr("RATE_LIMIT", "Rate limit exceeded");
  if (res.status === 529) throw aerr("OVERLOADED", "Model overloaded, try again later");

  const data = await res.json().catch(() => null);
  if (!res.ok) throw aerr("BAD_RESPONSE", data?.error?.message || `HTTP ${res.status}`);

  // Safety classifiers can decline with HTTP 200 + stop_reason "refusal" (empty content).
  if (data?.stop_reason === "refusal") throw aerr("BAD_RESPONSE", "Request was refused by the model");

  const text = (data?.content || [])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("")
    .trim();

  if (!text) throw aerr("BAD_RESPONSE", "Empty response from Anthropic");
  return text;
}
