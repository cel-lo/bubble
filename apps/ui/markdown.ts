// Small Markdown for agent messages: fenced code, `code`, **bold**, # headings. Everything is escaped
// first, so agent text can never inject HTML. Bubbles use white-space:pre-wrap, so lists and line breaks show as written.
import { t } from "./i18n";
export const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** pictures Walt saved (generated or attached): walt-img links become images; also used in your own bubbles */
export const pics = (s: string) =>
  s.replace(
    /!\[([^\]\n]*)\]\(walt-img:\/\/img\/([\w.-]+\.(?:png|jpe?g|webp|gif))\)/g,
    `<img class="gen" src="walt-img://img/$2" alt="$1" title="$1" data-hot="img:$2" style="display:block;max-width:min(100%,420px);border-radius:12px;margin:8px 0 2px;cursor:zoom-in"><span role="button" data-hot="mark:$2" style="display:inline-block;font-size:12px;color:#64A8FF;cursor:pointer;margin-bottom:6px">${esc(t("Mark and ask"))}</span>`,
  );
const inline = (s: string) =>
  pics(s)
    .replace(/`([^`\n]+)`/g, '<span class="mono" style="font-size:.9em;background:#ffffff14;border-radius:5px;padding:1px 5px">$1</span>')
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    // a web link opens in Walt's Browser tab or your browser (Settings · Browser); any other target (a file path)
    // shows its text only, with the target in the tooltip
    .replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (_, text: string, to: string) =>
      /^https?:\/\//i.test(to)
        ? `<span role="link" data-hot="link:${to}" title="${to}" style="color:#64A8FF;cursor:pointer;text-decoration:underline;text-decoration-color:#64A8FF60">${text}</span>`
        : `<span style="text-decoration:underline;text-decoration-color:#ffffff50" title="${to}">${text}</span>`,
    );

/** pipe tables: header row, separator row, then body rows */
const tables = (s: string) =>
  s.replace(/^(\|.*\|)[ \t]*\n\|[ \t:|-]+\|[ \t]*\n((?:\|.*\|[ \t]*(?:\n|$))*)/gm, (_, head: string, body: string) => {
    const row = (l: string, tag: string) =>
      `<tr>${l.trim().slice(1, -1).split("|").map((c) => `<${tag} style="padding:4px 12px 4px 0;border-bottom:1px solid #3A3A3C;text-align:left;vertical-align:top;overflow-wrap:normal;min-width:48px">${c.trim()}</${tag}>`).join("")}</tr>`;
    const rows = body.split("\n").filter((l) => l.trim());
    return `<table style="border-collapse:collapse;margin:6px 0;font-size:13px;display:block;overflow-x:auto;max-width:100%">${row(head, "th")}${rows.map((l) => row(l, "td")).join("")}</table>`;
  });

export function md(text: string) {
  return esc(text)
    .split(/^```[^\n]*\n([\s\S]*?)^```[ \t]*$\n?/m)
    .map((part, i) =>
      i % 2
        ? `<pre class="mono" style="margin:6px 0;padding:10px 12px;background:#141416;border-radius:10px;font-size:12.5px;white-space:pre-wrap;overflow-wrap:anywhere">${part.replace(/\n$/, "")}</pre>`
        : tables(inline(part)).replace(/^(#{1,3}) (.+)$\n?/gm, (_, h, t) => `<div class="b" style="font-size:${h.length === 1 ? 17 : 15.5}px;margin:4px 0">${t}</div>`),
    )
    .join("");
}
