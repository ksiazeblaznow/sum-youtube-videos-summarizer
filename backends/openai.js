// OpenAI (ChatGPT) backend — OpenAI chat-completions (/v1/chat/completions).
// Same wire shape as localhost/OpenRouter; only the base URL and auth header differ.

function oerr(code, msg) { const e = new Error(msg); e.code = code; return e; }

export async function generateOpenai({ systemPrompt, userContent, settings, signal }) {
  const key = settings.openaiApiKey;
  if (!key) throw oerr("NO_API_KEY", "Missing OpenAI API key");

  const model = settings.openaiModel || "gpt-4o-mini";

  let res;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.7
      })
    });
  } catch (e) {
    if (e.name === "AbortError") throw oerr("TIMEOUT", "Request timed out");
    throw oerr("BACKEND_UNREACHABLE", e.message);
  }

  if (res.status === 401 || res.status === 403) throw oerr("AUTH", "Invalid or unauthorized API key");
  if (res.status === 429) throw oerr("RATE_LIMIT", "Rate limit exceeded");
  if (res.status === 502 || res.status === 503) throw oerr("OVERLOADED", "Model/provider overloaded");

  const data = await res.json().catch(() => null);
  if (!res.ok) throw oerr("BAD_RESPONSE", data?.error?.message || `HTTP ${res.status}`);

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw oerr("BAD_RESPONSE", "Empty response from OpenAI");
  return text.trim();
}
