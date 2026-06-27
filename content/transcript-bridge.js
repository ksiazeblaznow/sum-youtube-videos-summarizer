// Runs in the MAIN world (page context). Reads YouTube's player response AND fetches
// the caption track here — a page-context fetch behaves like the player itself, so the
// timedtext endpoint returns a real body instead of the empty 200 it gives content-script
// (isolated-world) requests. Returns the finished transcript text via window.postMessage.

(function () {
  // #movie_player.getPlayerResponse() is the LIVE response; ytInitialPlayerResponse
  // goes stale after SPA navigation, so it's only a fallback.
  function readCaptionTracks() {
    const sources = [
      () => document.querySelector("#movie_player")?.getPlayerResponse?.(),
      () => document.querySelector("ytd-player")?.getPlayerResponse?.(),
      () => window.ytInitialPlayerResponse
    ];
    for (const get of sources) {
      try {
        const tracks = get()?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length) return tracks;
      } catch (e) { /* next */ }
    }
    return [];
  }

  function decodeEntities(s) {
    return s
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n));
  }

  function parseJson3(body) {
    const j = JSON.parse(body);
    return (j.events || [])
      .filter((e) => e.segs)
      .map((e) => e.segs.map((s) => s.utf8 || "").join(""))
      .join(" ").replace(/\s+/g, " ").trim();
  }

  function parseXml(body) {
    return [...body.matchAll(/<text[^>]*>(.*?)<\/text>/gs)]
      .map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, "")))
      .join(" ").replace(/\s+/g, " ").trim();
  }

  function parseVtt(body) {
    return body.split("\n")
      .filter((l) => l.trim() && !/-->/.test(l) && !/^WEBVTT/.test(l) && !/^\d+$/.test(l.trim()))
      .join(" ").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
  }

  async function tryFetch(url, label) {
    try {
      const r = await fetch(url, { credentials: "include" });
      const body = await r.text();
      console.log(`[YTSum bridge] ${label}: status=${r.status} bodyLen=${body.length}`);
      return r.ok ? body : "";
    } catch (e) {
      console.warn(`[YTSum bridge] ${label} fetch error:`, e);
      return "";
    }
  }

  async function fetchTranscriptText(track) {
    const withFmt = (fmt) => track.baseUrl + (track.baseUrl.includes("fmt=") ? "" : "&fmt=" + fmt);

    const j3 = await tryFetch(withFmt("json3"), "json3");
    if (j3) { try { const t = parseJson3(j3); if (t) return t; } catch (e) { console.warn("[YTSum bridge] json3 parse error:", e); } }

    const xml = await tryFetch(track.baseUrl, "xml");
    if (xml) { const t = parseXml(xml); if (t) return t; }

    const vtt = await tryFetch(withFmt("vtt"), "vtt");
    if (vtt) { const t = parseVtt(vtt); if (t) return t; }

    return "";
  }

  window.addEventListener("message", async (e) => {
    if (e.source !== window || !e.data || e.data.type !== "YT_TRANSCRIPT_REQUEST") return;
    const { requestId, preferredLang } = e.data;

    const reply = (payload) =>
      window.postMessage({ type: "YT_TRANSCRIPT_RESPONSE", requestId, ...payload }, "*");

    const tracks = readCaptionTracks();
    console.log("[YTSum bridge] caption tracks:", tracks.length, tracks.map((t) => t.languageCode));
    if (!tracks.length) return reply({ text: "", error: "no-tracks" });

    const track =
      tracks.find((t) => t.languageCode === preferredLang) ||
      tracks.find((t) => t.languageCode === "en") ||
      tracks[0];
    console.log("[YTSum bridge] chosen track:", track.languageCode, "kind:", track.kind || "manual");

    try {
      const text = await fetchTranscriptText(track);
      reply({ text, error: text ? null : "empty-body" });
    } catch (err) {
      reply({ text: "", error: String(err && err.message || err) });
    }
  });

  console.log("[YTSum bridge] loaded in MAIN world");
})();
