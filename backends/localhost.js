// Local LM Studio backend (OpenAI-compatible /chat/completions).

function lerr(code, msg) { const e = new Error(msg); e.code = code; return e; }

function chatUrl(settings) {
  const base = (settings.localhostBaseUrl || "http://localhost:1234/v1").replace(/\/$/, "");
  return base + "/chat/completions";
}

// Remove any reasoning that leaked into the answer text (models that don't separate it
// into message.reasoning_content emit inline <think>/<reasoning> blocks).
function stripThinking(s) {
  return s
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "") // unterminated/opening-only think block
    .trim();
}

export async function generateLocalhost({ systemPrompt, userContent, settings, signal }) {
  const disableThinking = settings.localhostDisableThinking !== false; // default on

  // /no_think is the soft switch honored by Qwen3-style "Thinking" models (read from the
  // user turn). reasoning_effort:"low" minimizes gpt-oss-style "Reasoning". LM Studio
  // ignores params a given model doesn't support.
  const userMsg = disableThinking ? `${userContent}\n\n/no_think` : userContent;

  const body = {
    model: settings.localhostModel || "local-model",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMsg }
    ],
    temperature: 0.7
  };
  if (disableThinking) body.reasoning_effort = "low";

  let res;
  try {
    res = await fetch(chatUrl(settings), {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
  } catch (e) {
    if (e.name === "AbortError") throw lerr("TIMEOUT", "Request timed out");
    throw lerr("BACKEND_UNREACHABLE", e.message);
  }

  if (res.status === 401 || res.status === 403) throw lerr("AUTH", "Unauthorized");

  const data = await res.json().catch(() => null);
  if (!res.ok) throw lerr("BAD_RESPONSE", data?.error?.message || `HTTP ${res.status}`);

  let text = data?.choices?.[0]?.message?.content || "";
  if (disableThinking) text = stripThinking(text);
  text = text.trim();
  if (!text) throw lerr("BAD_RESPONSE", "Empty response from local model");
  return text;
}
