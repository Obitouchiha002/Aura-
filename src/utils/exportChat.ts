/**
 * Chat export — Markdown file or PDF.
 *
 * PDF goes through the browser's own print pipeline rather than a bundled PDF
 * library: it costs nothing in bundle size, honours the user's paper size, and
 * gives real selectable text instead of a rasterised page.
 */

export interface ExportMessage {
  text: string;
  isAi: boolean;
  character?: string;
  attachments?: string[];
}

export interface ExportMeta {
  title: string;
  /** "The Council", "Thomas Shelby", … */
  speaker: string;
  mode: string;
  date: Date;
}

const MODE_LABEL: Record<string, string> = {
  COUNCIL: 'Council',
  MENTOR: 'Mentor',
  PSYCHOLOGY: 'Psychologist',
  TEACHER: 'Teacher',
  EMOTION: 'Poets',
};

function stamp(d: Date): string {
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function safeFilename(title: string): string {
  return (title || 'aura-chat')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 50) || 'aura-chat';
}

export function toMarkdown(meta: ExportMeta, messages: ExportMessage[]): string {
  const lines: string[] = [
    `# ${meta.title}`,
    '',
    `**${MODE_LABEL[meta.mode] ?? meta.mode}** · ${meta.speaker}  `,
    `${stamp(meta.date)}`,
    '',
    '---',
    '',
  ];

  for (const m of messages) {
    if (m.text.startsWith('[System]')) continue;

    const who = m.isAi ? (m.character || meta.speaker) : 'You';
    lines.push(`### ${who}`, '');
    if (m.attachments?.length) {
      lines.push(`*Attached: ${m.attachments.join(', ')}*`, '');
    }
    lines.push(m.text.trim(), '');
  }

  lines.push('---', '', '*Exported from Aura*', '');
  return lines.join('\n');
}

export function downloadMarkdown(meta: ExportMeta, messages: ExportMessage[]): void {
  const blob = new Blob([toMarkdown(meta, messages)], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename(meta.title)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

/**
 * Very small markdown → HTML pass for the printed page. Deliberately limited to
 * what the models actually emit: headings, bold, italic, code, lists, quotes,
 * rules. Everything is escaped first, so nothing from a reply can inject HTML.
 */
function miniMarkdown(src: string): string {
  const out: string[] = [];
  let inList: 'ul' | 'ol' | null = null;
  let inCode = false;

  const closeList = () => { if (inList) { out.push(`</${inList}>`); inList = null; } };

  for (const rawLine of escapeHtml(src).split('\n')) {
    const line = rawLine.trimEnd();

    if (/^```/.test(line)) {
      closeList();
      out.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(line); continue; }

    if (!line.trim()) { closeList(); continue; }

    if (/^---+$/.test(line.trim())) { closeList(); out.push('<hr/>'); continue; }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      closeList();
      const level = Math.min(heading[1].length + 1, 6);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    const quote = /^&gt;\s?(.*)$/.exec(line);
    if (quote) { closeList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }

    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      if (inList !== 'ol') { closeList(); out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ul) {
      if (inList !== 'ul') { closeList(); out.push('<ul>'); inList = 'ul'; }
      out.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeList();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}

function inline(s: string): string {
  return s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\W)\*([^*]+)\*/g, '$1<em>$2</em>');
}

export function printAsPdf(meta: ExportMeta, messages: ExportMessage[]): boolean {
  const body = messages
    .filter(m => !m.text.startsWith('[System]'))
    .map(m => {
      const who = m.isAi ? (m.character || meta.speaker) : 'You';
      const attached = m.attachments?.length
        ? `<p class="att">Attached: ${escapeHtml(m.attachments.join(', '))}</p>`
        : '';
      return `<section class="msg ${m.isAi ? 'ai' : 'me'}">
        <h4>${escapeHtml(who)}</h4>
        ${attached}
        ${miniMarkdown(m.text)}
      </section>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(meta.title)}</title>
<style>
  @page { margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font: 11pt/1.55 -apple-system, "Segoe UI", Roboto, sans-serif; color: #14171c; margin: 0; }
  header { border-bottom: 2px solid #14171c; padding-bottom: 10px; margin-bottom: 22px; }
  h1 { font-size: 19pt; margin: 0 0 6px; letter-spacing: -0.01em; }
  .meta { font-size: 9.5pt; color: #5c626c; }
  .msg { margin: 0 0 18px; page-break-inside: avoid; }
  .msg h4 { font-size: 9pt; text-transform: uppercase; letter-spacing: .08em;
            color: #5c626c; margin: 0 0 5px; font-weight: 600; }
  .msg.me { padding-left: 12px; border-left: 3px solid #c9343a; }
  .msg p { margin: 0 0 8px; }
  .msg h2, .msg h3, .msg h4.head { margin: 12px 0 6px; }
  ul, ol { margin: 0 0 8px; padding-left: 20px; }
  li { margin-bottom: 4px; }
  blockquote { margin: 0 0 8px; padding-left: 12px; border-left: 2px solid #c8cdd6; color: #5c626c; }
  pre { background: #f3f5f7; border: 1px solid #dde2ea; border-radius: 6px;
        padding: 9px 11px; overflow-x: auto; font-size: 9.5pt; margin: 0 0 8px; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: .92em; }
  pre code { background: none; }
  hr { border: 0; border-top: 1px solid #dde2ea; margin: 14px 0; }
  .att { font-size: 9pt; color: #5c626c; font-style: italic; margin: 0 0 6px; }
  footer { margin-top: 26px; padding-top: 10px; border-top: 1px solid #dde2ea;
           font-size: 8.5pt; color: #6e747f; }
</style></head>
<body>
  <header>
    <h1>${escapeHtml(meta.title)}</h1>
    <div class="meta">${escapeHtml(MODE_LABEL[meta.mode] ?? meta.mode)} · ${escapeHtml(meta.speaker)} · ${escapeHtml(stamp(meta.date))}</div>
  </header>
  ${body}
  <footer>Exported from Aura</footer>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;   // popup blocked — the caller tells the user

  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the print stylesheet a beat to apply before the dialog opens.
  w.onload = () => setTimeout(() => { w.focus(); w.print(); }, 250);
  return true;
}
