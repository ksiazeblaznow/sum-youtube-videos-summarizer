// Injected side panel (result UI). Shares the isolated content-script realm with
// inject-button.js, so `YTSumPanel`, `renderMarkdown` and `t` are all visible here.

const YTSumPanel = (function () {
  let root, bodyEl, titleEl, resultEl, qaEl, askBar, askInput, askBtn;
  let lang = "pl";
  let currentMarkdown = "";
  let onRerun = null;
  let onAsk = null;
  let pending = false;

  function build() {
    if (root) return;
    root = document.createElement("div");
    root.id = "ytsum-panel";
    root.innerHTML = `
      <div id="ytsum-header">
        <span id="ytsum-title"></span>
        <div id="ytsum-actions">
          <button data-act="copy" class="ytsum-iconbtn" title="">⧉</button>
          <button data-act="rerun" class="ytsum-iconbtn" title="">↻</button>
          <button data-act="settings" class="ytsum-iconbtn" title="">⚙</button>
          <button data-act="close" class="ytsum-iconbtn" title="">✕</button>
        </div>
      </div>
      <div id="ytsum-body">
        <div id="ytsum-result"></div>
        <div id="ytsum-qa"></div>
      </div>
      <div id="ytsum-ask" hidden>
        <input id="ytsum-ask-input" type="text" />
        <button id="ytsum-ask-send" class="ytsum-iconbtn">➤</button>
      </div>`;
    document.body.appendChild(root);
    bodyEl = root.querySelector("#ytsum-body");
    titleEl = root.querySelector("#ytsum-title");
    resultEl = root.querySelector("#ytsum-result");
    qaEl = root.querySelector("#ytsum-qa");
    askBar = root.querySelector("#ytsum-ask");
    askInput = root.querySelector("#ytsum-ask-input");
    askBtn = root.querySelector("#ytsum-ask-send");
    root.querySelector("#ytsum-actions").addEventListener("click", onActionClick);
    askBtn.addEventListener("click", submitQuestion);
    askInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitQuestion(); }
    });
  }

  function refreshLabels() {
    titleEl.textContent = t("panelTitle", lang);
    root.querySelector('[data-act="copy"]').title = t("copy", lang);
    root.querySelector('[data-act="rerun"]').title = t("rerun", lang);
    root.querySelector('[data-act="settings"]').title = t("settings", lang);
    root.querySelector('[data-act="close"]').title = t("close", lang);
    askInput.placeholder = t("askPlaceholder", lang);
  }

  function onActionClick(e) {
    const act = e.target.closest("button")?.dataset.act;
    if (!act) return;
    if (act === "close") return close();
    if (act === "rerun") return onRerun && onRerun();
    if (act === "settings") return chrome.runtime.sendMessage({ action: "openOptions" });
    if (act === "copy") {
      navigator.clipboard.writeText(currentMarkdown).then(() => {
        const btn = e.target.closest("button");
        const old = btn.textContent;
        btn.textContent = "✓";
        setTimeout(() => (btn.textContent = old), 1200);
      });
    }
  }

  function setPending(p) {
    pending = p;
    askInput.disabled = p;
    askBtn.disabled = p;
  }

  function scrollEnd() { bodyEl.scrollTop = bodyEl.scrollHeight; }

  function appendQA(question) {
    const item = document.createElement("div");
    item.className = "ytsum-qa-item";
    const q = document.createElement("div");
    q.className = "ytsum-q";
    q.textContent = question; // textContent => no injection from user input
    const a = document.createElement("div");
    a.className = "ytsum-a ytsum-pending";
    a.innerHTML = `<div class="ytsum-spinner"></div>`;
    item.appendChild(q);
    item.appendChild(a);
    qaEl.appendChild(item);
    return a;
  }

  function submitQuestion() {
    const question = askInput.value.trim();
    if (!question || pending || !onAsk) return;
    askInput.value = "";
    const ans = appendQA(question);
    setPending(true);
    scrollEnd();
    onAsk(question, {
      done: (md) => { ans.classList.remove("ytsum-pending"); ans.innerHTML = renderMarkdown(md); setPending(false); scrollEnd(); askInput.focus(); },
      fail: (msg) => { ans.classList.remove("ytsum-pending"); ans.classList.add("ytsum-error"); ans.textContent = msg; setPending(false); scrollEnd(); }
    });
  }

  function open(opts) {
    build();
    lang = opts.lang || "pl";
    onRerun = opts.onRerun || null;
    onAsk = opts.onAsk || null;
    refreshLabels();
    root.classList.add("ytsum-visible");
  }

  function setLoading(msgKey) {
    askBar.hidden = true;
    qaEl.innerHTML = "";
    resultEl.innerHTML = `<div class="ytsum-state"><div class="ytsum-spinner"></div><span>${t(msgKey || "loading", lang)}</span></div>`;
  }

  function setResult(markdown) {
    currentMarkdown = markdown || "";
    resultEl.innerHTML = `<div class="ytsum-result">${renderMarkdown(currentMarkdown)}</div>`;
    qaEl.innerHTML = "";
    setPending(false);
    askBar.hidden = false;
    bodyEl.scrollTop = 0;
  }

  function setError(message) {
    askBar.hidden = true;
    qaEl.innerHTML = "";
    resultEl.innerHTML = `<div class="ytsum-state ytsum-error">⚠️ <span></span></div>`;
    resultEl.querySelector("span").textContent = message; // textContent => no injection
  }

  function close() { if (root) root.classList.remove("ytsum-visible"); }

  function isOpen() { return !!(root && root.classList.contains("ytsum-visible")); }

  return { open, setLoading, setResult, setError, close, isOpen };
})();
