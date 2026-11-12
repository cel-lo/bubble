// Small Markdown for agent messages: fenced code, `code`, **bold**, # headings. Everything is escaped
// first, so agent text can never inject HTML. Bubbles use white-space:pre-wrap, so lists and line breaks show as written.
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const inline = (s: string) =>
  s
    .replace(/`([^`\n]+)`/g, '<span class="mono" style="font-size:.9em;background:#ffffff14;border-radius:5px;padding:1px 5px">$1</span>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>");

export function md(text: string) {
  return esc(text)
    .split(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$\n?/m)
    .map((part, i) =>
      i % 2
        ? `<pre class="mono" style="margin:6px 0;padding:10px 12px;background:#141416;border-radius:10px;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere">${part.replace(/\n$/, "")}</pre>`
        : inline(part).replace(/^(#{1,3}) (.+)$\n?/gm, (_, h, t) => `<div class="b" style="font-size:${h.length === 1 ? 17 : 15.5}px;margin:4px 0">${t}</div>`),
    )
    .join("");
}
