// Minimal, sanitizing Markdown -> HTML renderer.
// The whole source is HTML-escaped FIRST, then only our own whitelisted tags are
// re-introduced, so untrusted model output cannot inject markup. Classic script:
// defines a global `renderMarkdown` shared across content-script files and the options page.

function ytsumEscapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ytsumInline(s) {
  // inline code (protect contents from further formatting)
  s = s.replace(/`([^`]+)`/g, (m, c) => `<code>${c}</code>`);
  // links [text](url) — only http(s), url already escaped so safe in attribute
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, t, u) => {
    if (!/^https?:\/\//i.test(u)) return t;
    return `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/(^|[\s(])_([^_]+)_/g, "$1<em>$2</em>");
  return s;
}

function renderMarkdown(md) {
  if (!md) return "";
  const lines = ytsumEscapeHtml(md.replace(/\r\n/g, "\n")).split("\n");
  let html = "";
  let list = null; // "ul" | "ol"
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const isBlockStart = (l) =>
    /^(#{1,6}\s|```|\s*[-*+]\s|\s*\d+\.\s|&gt;)/.test(l);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      closeList();
      i++;
      let code = "";
      while (i < lines.length && !/^```/.test(lines[i])) { code += lines[i] + "\n"; i++; }
      i++; // skip closing fence
      html += `<pre><code>${code}</code></pre>`;
      continue;
    }
    if (/^\s*$/.test(line)) { closeList(); i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lvl = h[1].length; html += `<h${lvl}>${ytsumInline(h[2])}</h${lvl}>`; i++; continue; }

    if (/^(\-{3,}|\*{3,})\s*$/.test(line)) { closeList(); html += "<hr>"; i++; continue; }

    const bq = line.match(/^&gt;\s?(.*)$/);
    if (bq) { closeList(); html += `<blockquote>${ytsumInline(bq[1])}</blockquote>`; i++; continue; }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) { if (list !== "ul") { closeList(); html += "<ul>"; list = "ul"; } html += `<li>${ytsumInline(ul[1])}</li>`; i++; continue; }

    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { if (list !== "ol") { closeList(); html += "<ol>"; list = "ol"; } html += `<li>${ytsumInline(ol[1])}</li>`; i++; continue; }

    // paragraph: gather consecutive plain lines
    closeList();
    let para = line; i++;
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !isBlockStart(lines[i])) { para += " " + lines[i]; i++; }
    html += `<p>${ytsumInline(para)}</p>`;
  }
  closeList();
  return html;
}
