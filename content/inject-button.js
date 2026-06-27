// Injects the "Summarize" button into the watch-page action bar and orchestrates
// transcript extraction -> background -> panel. Isolated world.

const YTSUM_CONTAINERS = [
  "ytd-menu-renderer.ytd-watch-metadata",
  "#top-level-buttons-computed",
  "#actions-inner"
];

let ytsumLang = "pl";
let ytsumCache = { videoId: null, text: "" }; // last successful summary, per video

function withCode(code, msg) { const e = new Error(msg); e.code = code; return e; }

function localizeError(code) { return t("errors." + (code || "GENERIC"), ytsumLang); }

// Map a thrown error to an error code. A reloaded/updated extension orphans this content
// script: chrome.runtime goes away and sendMessage throws with no .code — surface that as
// an actionable "refresh the page" message instead of a bare GENERIC.
function classifyError(e) {
  if (e && e.code) return e.code;
  const m = ((e && e.message) || "").toLowerCase();
  if (!chrome.runtime?.id || m.includes("context invalidated") || m.includes("receiving end does not exist"))
    return "CONTEXT_STALE";
  return "GENERIC";
}

function currentVideoId() { return new URLSearchParams(location.search).get("v"); }

function getVideoTitle() {
  const el =
    document.querySelector("h1.ytd-watch-metadata yt-formatted-string") ||
    document.querySelector("h1.ytd-watch-metadata") ||
    document.querySelector("#title h1");
  return el ? el.textContent.trim() : "";
}

function findContainer() {
  for (const sel of YTSUM_CONTAINERS) {
    const el = document.querySelector(sel);
    if (el) return el;
  }
  return null;
}

// --- Transcript extraction ---
// The actual caption download happens in the MAIN-world bridge (page context), because
// timedtext returns an empty body to isolated-world content-script fetches. We just ask
// the bridge for the finished text.

function requestTranscript(preferredLang) {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    let settled = false;
    const onMsg = (e) => {
      if (e.source !== window || e.data?.type !== "YT_TRANSCRIPT_RESPONSE" || e.data.requestId !== requestId) return;
      settled = true;
      window.removeEventListener("message", onMsg);
      resolve({ text: e.data.text || "", error: e.data.error });
    };
    window.addEventListener("message", onMsg);
    window.postMessage({ type: "YT_TRANSCRIPT_REQUEST", requestId, preferredLang }, "*");
    setTimeout(() => {
      if (settled) return;
      window.removeEventListener("message", onMsg);
      console.warn("[YTSum] bridge did not respond within 15s — MAIN-world script may not be loaded");
      resolve({ text: "", error: "bridge-timeout" });
    }, 15000);
  });
}

// Fallback: scrape YouTube's own "Show transcript" engagement panel. Works even when
// the timedtext endpoint is gated, because YouTube renders the transcript itself.

function waitFor(fn, timeout = 6000, interval = 250) {
  return new Promise((resolve) => {
    const start = Date.now();
    (function tick() {
      let r = null;
      try { r = fn(); } catch (e) { /* ignore */ }
      const ok = r && (r.length === undefined ? true : r.length > 0);
      if (ok) return resolve(r);
      if (Date.now() - start > timeout) return resolve(null);
      setTimeout(tick, interval);
    })();
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// YouTube buttons use Polymer on-tap gestures that often ignore element.click();
// dispatch a real pointer+mouse sequence instead.
function realClick(el) {
  const o = { bubbles: true, cancelable: true, view: window };
  try { el.dispatchEvent(new PointerEvent("pointerdown", o)); } catch (e) { /* older */ }
  el.dispatchEvent(new MouseEvent("mousedown", o));
  try { el.dispatchEvent(new PointerEvent("pointerup", o)); } catch (e) { /* older */ }
  el.dispatchEvent(new MouseEvent("mouseup", o));
  el.dispatchEvent(new MouseEvent("click", o));
}

// innerText (not textContent) is render-aware: a hidden panel returns "", so non-empty
// text reliably means the panel is actually open — more robust than the visibility attr,
// whose value differs between the classic and modern transcript layouts.
function isOpenPanel(panel) {
  return (panel.getAttribute("visibility") || "").includes("EXPANDED") ||
         (panel.innerText || "").trim().length > 200;
}

// All transcript panel variants present (classic "searchable-transcript" AND the newer
// "modern_transcript_view" — a video may populate either one).
function allTranscriptPanels() {
  // Current YouTube renders the open transcript in a panel whose target-id is null,
  // so target-id matching alone misses it — also accept any panel that actually
  // contains transcript segment nodes (modern view-model or the classic renderer).
  return [...document.querySelectorAll("ytd-engagement-panel-section-list-renderer")]
    .filter((p) =>
      (p.getAttribute("target-id") || "").toLowerCase().includes("transcript") ||
      p.querySelector("transcript-segment-view-model, ytd-transcript-segment-renderer"));
}

// Read text from whichever transcript panel actually has it (don't assume which variant).
function readAnyTranscriptText() {
  for (const p of allTranscriptPanels()) {
    const t = readPanelText(p);
    if (t) return t;
  }
  return "";
}

function stripTimestamps(s) {
  return s.replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, " ").replace(/\s+/g, " ").trim();
}

function readPanelText(panel) {
  // 0. Modern view-model segments (current YouTube). Read only the text span so the
  //    leading timestamp (glued into textContent as "0:00…") doesn't leak in.
  const vms = panel.querySelectorAll("transcript-segment-view-model");
  if (vms.length) {
    return [...vms]
      .map((s) => {
        const el = s.querySelector("span.ytAttributedStringHost, span[role='text']");
        return (el ? el.textContent : s.textContent).trim();
      })
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  // 1. Classic segment renderer.
  const segs = panel.querySelectorAll("ytd-transcript-segment-renderer");
  if (segs.length) {
    return [...segs]
      .map((s) => {
        const el = s.querySelector(".segment-text") || s.querySelector("yt-formatted-string");
        return (el ? el.textContent : s.textContent).trim();
      })
      .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  // 2. Modern view: rows carry a "segment-text"-ish class.
  const nodes = panel.querySelectorAll('[class*="segment-text"], .segment-text, .cue');
  if (nodes.length) {
    return [...nodes].map((n) => n.textContent.trim()).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  }
  // 3. Last resort: the panel's rendered text, with timestamps stripped (a little header
  //    noise is fine — the LLM tolerates it). Works whatever the modern view's internals are.
  const raw = (panel.innerText || "").trim();
  if (raw.length > 200) return stripTimestamps(raw);
  return "";
}

function findTranscriptTrigger() {
  const sectionBtn = document.querySelector("ytd-video-description-transcript-section-renderer button");
  if (sectionBtn) return { btn: sectionBtn, via: "description-section" };
  const byAria = [...document.querySelectorAll("button")].find((b) => {
    const a = (b.getAttribute("aria-label") || "").toLowerCase();
    return a.includes("transcript") || a.includes("transkry");
  });
  if (byAria) return { btn: byAria, via: "aria-label" };
  return null;
}

function closeTranscriptPanel() {
  for (const p of allTranscriptPanels()) {
    const closeBtn = p.querySelector("#visibility-button button");
    if (closeBtn) realClick(closeBtn);
  }
}

async function scrapeTranscriptPanel() {
  // Already showing text in some transcript panel? Use it.
  let text = readAnyTranscriptText();
  if (text) return text;

  // Open it: expand the description, then click the transcript trigger.
  const expand = document.querySelector("tp-yt-paper-button#expand, #description #expand");
  if (expand) { realClick(expand); await sleep(300); }

  const trigger = findTranscriptTrigger();
  if (trigger) { console.log("[YTSum] opening transcript panel via:", trigger.via); realClick(trigger.btn); }
  else console.log("[YTSum] no transcript trigger found; waiting in case it opens anyway…");

  // Poll EVERY transcript panel for text — a video may populate either variant, and long
  // transcripts render slowly. 15s budget.
  text = await waitFor(() => readAnyTranscriptText() || null, 15000, 300);

  if (!text) {
    const panels = allTranscriptPanels();
    console.log("[YTSum] no transcript text extracted from any panel. Probe:",
      panels.map((p) => ({
        id: p.getAttribute("target-id"),
        vis: p.getAttribute("visibility"),
        segs: p.querySelectorAll("ytd-transcript-segment-renderer").length,
        textLen: (p.innerText || "").length
      })));
    return "";
  }
  console.log("[YTSum] transcript text length:", text.length);

  closeTranscriptPanel(); // stay non-invasive
  return text;
}

async function fetchTranscript() {
  const { text, error } = await requestTranscript(ytsumLang);
  console.log("[YTSum] bridge transcript length:", text.length, "| error:", error || "none");
  if (text) return text;

  console.log("[YTSum] timedtext empty — falling back to transcript-panel scrape…");
  const scraped = await scrapeTranscriptPanel();
  console.log("[YTSum] scraped transcript length:", scraped.length);
  if (scraped) return scraped;

  throw withCode("NO_TRANSCRIPT", error || "no transcript");
}

// --- Button + flow ---

// Follow-up Q&A: answer questions grounded in the cached transcript.
function makeAskHandler(videoId) {
  return (question, cbs) => {
    const history = ytsumCache.qa || [];
    chrome.runtime.sendMessage({
      action: "askQuestion",
      question,
      history,
      transcript: ytsumCache.transcript || "",
      title: getVideoTitle(),
      videoId
    }).then((resp) => {
      if (!resp) return cbs.fail(localizeError("BACKEND_UNREACHABLE"));
      if (resp.error) {
        const detail = resp.error && resp.error !== localizeError(resp.code) ? ` — ${resp.error}` : "";
        return cbs.fail(localizeError(resp.code) + detail);
      }
      ytsumCache.qa = [...history, { q: question, a: resp.answer }];
      cbs.done(resp.answer);
    }).catch((e) => cbs.fail(localizeError(classifyError(e))));
  };
}

async function onSummarizeClick(btn, force = false) {
  const videoId = currentVideoId();

  // Already generated for this video: reopen the panel if it's collapsed, otherwise
  // (already open and showing it) do nothing. "force" comes from the panel's Regenerate.
  if (!force && ytsumCache.videoId === videoId && ytsumCache.text) {
    if (!YTSumPanel.isOpen()) {
      YTSumPanel.open({ lang: ytsumLang, onRerun: () => onSummarizeClick(btn, true), onAsk: makeAskHandler(videoId) });
      YTSumPanel.setResult(ytsumCache.text);
    }
    return;
  }

  const label = btn.querySelector(".ytsum-label");
  const icon = btn.querySelector(".ytsum-icon");
  btn.disabled = true;
  if (label) label.textContent = t("summarizing", ytsumLang);
  if (icon) icon.textContent = "✧";

  YTSumPanel.open({ lang: ytsumLang, onRerun: () => onSummarizeClick(btn, true), onAsk: makeAskHandler(videoId) });
  YTSumPanel.setLoading("fetchingTranscript");

  try {
    const transcript = await fetchTranscript();
    YTSumPanel.setLoading("loading"); // transcript in hand → now generating
    const resp = await chrome.runtime.sendMessage({
      action: "summarizeVideo",
      transcript,
      title: getVideoTitle(),
      videoId
    });
    if (!resp) throw withCode("BACKEND_UNREACHABLE", "no response");
    if (resp.error) {
      const detail = resp.error && resp.error !== localizeError(resp.code) ? ` — ${resp.error}` : "";
      YTSumPanel.setError(localizeError(resp.code) + detail);
      return;
    }
    const note = resp.fallback ? `> _${t("fallbackNote", ytsumLang)}_\n\n` : "";
    const out = note + resp.summary;
    ytsumCache = { videoId, text: out, transcript, qa: [] };
    YTSumPanel.setResult(out);
  } catch (e) {
    YTSumPanel.setError(localizeError(classifyError(e)));
  } finally {
    btn.disabled = false;
    if (label) label.textContent = t("summarize", ytsumLang);
    if (icon) icon.textContent = "✦";
  }
}

function injectButton() {
  const container = findContainer();
  if (!container) return false;
  if (document.querySelector("#ytsum-btn")) return true;

  const btn = document.createElement("button");
  btn.id = "ytsum-btn";
  btn.innerHTML = `<span class="ytsum-icon">✦</span><span class="ytsum-label"></span>`;
  btn.querySelector(".ytsum-label").textContent = t("summarize", ytsumLang);
  btn.addEventListener("click", () => onSummarizeClick(btn));
  container.insertBefore(btn, container.firstChild);
  return true;
}

async function onNavigate() {
  const settings = await loadSettings();
  ytsumLang = settings.language || "pl";
  YTSumPanel.close();
  if (!location.pathname.startsWith("/watch")) return;

  let attempts = 0;
  const iv = setInterval(() => {
    if (injectButton() || attempts++ > 20) clearInterval(iv);
  }, 500);
}

document.addEventListener("yt-navigate-finish", onNavigate);
setTimeout(onNavigate, 1500); // direct page load / F5
