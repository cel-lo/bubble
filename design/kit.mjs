// Walt design kit: tokens, icons, avatars and shared layout pieces (HTML strings rendered by build.mjs).
import fs from "fs";
import path from "path";
const HERE = path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Z]:)/, "$1");
const codexPng = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "assets", "codex.png")).toString("base64");
const antigravityPng = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "assets", "antigravity.png")).toString("base64");
const geminiPng = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "assets", "gemini.png")).toString("base64");
const waltPng = "data:image/png;base64," + fs.readFileSync(path.join(HERE, "assets", "walt.png")).toString("base64");

export const T = {
  bg: "#1C1C1E", side: "#151517", rail: "#101012", card: "#28282A", card2: "#232325", line: "#323234", line2: "#29292E",
  text: "#F5F5F7", sub: "#C7C7CC", dim: "#909097", faint: "#58585F", green: "#30C759", blue: "#5B6CFF", cyan: "#22D3EE",
  purple: "#A855F7", amber: "#FFB340", red: "#FF453A",
};
export const ENG = {
  codex: { name: "Codex", color: "#7F87FF", tile: "#ECEEFF", engine: "Codex CLI", model: "Default" },
  claude: { name: "Claude Opus", color: "#E08A68", tile: "#F7E4DB", engine: "Claude Code", model: "Opus 5.5" },
  sonnet: { name: "Claude Sonnet", color: "#E8B04B", tile: "#FBEED2", engine: "Claude Code", model: "Sonnet 5.5" },
  gemini: { name: "Gemini", color: "#22D3EE", tile: "#FFFFFF", engine: "Gemini CLI", model: "Default" },
  antigravity: { name: "Antigravity", color: "#4F8EF7", tile: "#FFFFFF", engine: "Antigravity CLI", model: "Default" },
  cello: { name: "cello", color: "#30C759", tile: "#3A3A3C" },
};

export const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;color:${T.text};background:transparent}
#root{position:relative;overflow:hidden}
.row{display:flex;align-items:center}.col{display:flex;flex-direction:column}
.g4{gap:4px}.g6{gap:6px}.g8{gap:8px}.g10{gap:10px}.g12{gap:12px}.g16{gap:16px}.g20{gap:20px}
.f1{flex:1}.sb{justify-content:space-between}.cen{justify-content:center}
.dim{color:${T.dim}}.sub{color:${T.sub}}.faint{color:${T.faint}}
.b{font-weight:600}.bb{font-weight:700}
.s11{font-size:11px}.s12{font-size:12px}.s13{font-size:13px}.s14{font-size:14px}.s15{font-size:15px}.s16{font-size:16px}.s18{font-size:18px}.s20{font-size:20px}.s24{font-size:24px}
.mono{font-family:"Cascadia Mono",Consolas,monospace}
/* window */
.win{width:100%;height:100%;background:${T.bg};border-radius:10px;border:1px solid #2E2E30;display:flex;flex-direction:column;overflow:hidden}
.tb{height:40px;background:${T.rail};display:flex;align-items:center;padding:0 0 0 14px;gap:14px;border-bottom:1px solid #1E1E20;flex:none}
.wsel{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;padding:4px 10px;border-radius:8px;background:#1C1C1E}
.wctl{display:flex;margin-left:auto}.wctl span{width:46px;height:40px;display:flex;align-items:center;justify-content:center}
.bd{flex:1;display:flex;min-height:0}
.rail{width:60px;background:${T.rail};border-right:1px solid #1E1E20;display:flex;flex-direction:column;align-items:center;padding:12px 0;gap:6px;flex:none}
.ri{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;position:relative}
.ri.on{background:#26262A}
.ri .dot{position:absolute;right:7px;top:7px;width:7px;height:7px;border-radius:4px;background:${T.green}}
.side{width:264px;background:${T.side};border-right:1px solid #232325;padding:14px 10px;display:flex;flex-direction:column;gap:4px;flex:none}
.main{flex:1;display:flex;flex-direction:column;min-width:0}
.insp{width:320px;background:${T.side};border-left:1px solid #232325;display:flex;flex-direction:column;flex:none}
.sect{font-size:12px;color:${T.dim};font-weight:600;padding:12px 8px 6px;display:flex;justify-content:space-between;align-items:center}
.item{display:flex;align-items:center;gap:10px;padding:8px;border-radius:10px}
.item.on{background:#26262A}
.item .t{font-size:14px;font-weight:600}.item .p{font-size:12.5px;color:${T.dim};margin-top:1px}
.udot{width:8px;height:8px;border-radius:4px;background:${T.blue}}
/* room */
.rh{height:64px;border-bottom:1px solid ${T.line2};display:flex;align-items:center;padding:0 18px 0 22px;gap:12px;flex:none}
.rtile{width:36px;height:36px;border-radius:10px;background:${T.card2};display:flex;align-items:center;justify-content:center}
.wf{height:46px;border-bottom:1px solid ${T.line2};background:#19191B;display:flex;align-items:center;padding:0 18px 0 22px;gap:12px;font-size:13px;flex:none}
.pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:600}
.step{display:flex;align-items:center;gap:6px;font-size:12.5px;color:${T.dim}}
.step i{width:8px;height:8px;border-radius:4px;border:1.5px solid ${T.faint};display:block}
.step.on{color:${T.text};font-weight:600}.step.on i{background:${T.green};border-color:${T.green}}
.step.done{color:${T.sub}}.step.done i{background:${T.dim};border-color:${T.dim}}
.btn{display:inline-flex;align-items:center;gap:7px;height:32px;padding:0 13px;border-radius:9px;font-size:13px;font-weight:600;background:#2C2C2E;color:${T.text};white-space:nowrap}
.btn.g{background:${T.green};color:#04170B}.btn.r{background:rgba(255,69,58,.16);color:#FF6961}.btn.o{background:transparent;border:1px solid #3A3A3C}
.btn.sm{height:28px;padding:0 10px;font-size:12.5px;border-radius:8px}.btn.dis{opacity:.4}
.tl{flex:1;overflow:hidden;padding:8px 0 0}
.tli{max-width:780px;margin:0 auto;padding:0 24px}
.day{text-align:center;font-size:12px;color:${T.faint};margin:14px 0 6px}
.msg{display:flex;gap:12px;margin:14px 0}
.mh{display:flex;align-items:center;gap:8px;font-size:12.5px;color:${T.dim};margin-bottom:5px}
.mh .n{font-size:13.5px;font-weight:600;color:${T.text}}
.role{font-size:11px;font-weight:600;padding:1px 7px;border-radius:6px}
.bub{background:#2A2A2C;border-radius:16px;padding:11px 15px;font-size:14.5px;line-height:1.55;max-width:690px}
.bub p+p{margin-top:8px}
.me{justify-content:flex-end}.me .bub{background:#1E3A28;border-top-right-radius:6px}
.ho{font-size:13px;color:${T.dim};margin:12px 0 12px 44px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.ho b{color:${T.text};font-weight:600}
.tool{display:inline-flex;gap:8px;align-items:center;background:${T.card2};border:1px solid ${T.line};border-radius:10px;padding:6px 10px;font-size:12.5px;color:${T.sub};margin-top:8px}
.card{background:${T.card2};border:1px solid ${T.line};border-radius:14px}
.chip{display:inline-flex;align-items:center;gap:6px;padding:4px 9px;border-radius:8px;background:#2C2C2E;font-size:12px;color:${T.sub};white-space:nowrap}
.comp{padding:8px 24px 16px;flex:none}
.cbox{width:100%;max-width:740px;margin:0 auto;border:1px solid #3A3A3C;border-radius:22px;background:${T.card2};min-height:56px;display:flex;align-items:center;padding:0 10px 0 16px;gap:12px}
.send{width:36px;height:36px;border-radius:18px;background:${T.green};display:flex;align-items:center;justify-content:center}
.route{width:100%;max-width:740px;margin:8px auto 0;display:flex;align-items:center;gap:14px;font-size:12.5px;color:${T.dim};padding-left:14px}
.tabs{display:flex;gap:4px;padding:12px 12px 0;border-bottom:1px solid ${T.line2}}
.tab{font-size:13px;color:${T.dim};padding:7px 8px 10px;font-weight:600}
.tab.on{color:${T.text};box-shadow:inset 0 -2px 0 ${T.green}}
.kv{display:flex;justify-content:space-between;font-size:13px;padding:7px 0;border-bottom:1px solid ${T.line2}}
.lbl{font-size:11px;font-weight:600;color:${T.dim};letter-spacing:.04em;text-transform:uppercase;margin:16px 0 8px}
.tog{width:38px;height:22px;border-radius:11px;background:${T.green};position:relative}
.tog::after{content:"";position:absolute;right:2px;top:2px;width:18px;height:18px;border-radius:9px;background:#fff}
.tog.off{background:#3A3A3C}.tog.off::after{right:auto;left:2px}
.seg{display:inline-flex;background:#363638;border-radius:8px;padding:2px}
.seg span{font-size:12.5px;padding:4px 12px;border-radius:6px;color:${T.sub}}
.seg span.on{background:#545456;color:#fff;font-weight:600}
.cur{display:inline-block;width:2px;height:16px;background:${T.text};vertical-align:-3px;margin-left:2px}
/* light theme */
.light .win{background:#FFFFFF;border-color:#D8D8DC}
.light .tb,.light .rail{background:#F2F2F7;border-color:#E3E3E8}
.light .wsel{background:#FFFFFF}
.light .side,.light .insp{background:#F7F7FA;border-color:#E3E3E8}
.light .item.on,.light .ri.on{background:#E9E9EF}
.light .rh,.light .wf,.light .tabs,.light .kv{border-color:#E8E8ED}
.light .wf{background:#FAFAFC}
.light .bub{background:#F1F1F5;color:#1C1C1E}.light .me .bub{background:#DDF5E4}
.light .mh .n,.light .ho b,.light .item .t,.light .s16,.light .tab.on{color:#1C1C1E}
.light .tool,.light .card,.light .cbox{background:#F7F7FA;border-color:#E3E3E8;color:#3A3A3C}
.light .chip,.light .btn{background:#ECECF1;color:#1C1C1E}.light .btn.g{background:${T.green};color:#04170B}
.light .step.on{color:#1C1C1E}.light .win{color:#1C1C1E}.light .dim{color:#6E6E73}.light .sub{color:#48484A}.light .faint{color:#AEAEB2}.light .ri.on{background:#E2E2E8}
`;

// ---------- icons (stroke) ----------
const P = {
  chat: '<path d="M4 5.5h16v11H9.5L5 20v-3.5H4z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  tasks: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/>',
  memory: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z"/>',
  usage: '<path d="M5 19V10M12 19V5M19 19v-6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  folder: '<path d="M3.5 7a2 2 0 0 1 2-2H10l2 2h6.5a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.8 3 2.4 3.5 4.7"/>',
  more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  pause: '<path d="M9 6v12M15 6v12"/>',
  stop: '<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
  mic: '<rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  clip: '<path d="M20 11.5l-8 8a5 5 0 0 1-7-7l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.4 8.4a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6"/>',
  slash: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M14 8l-4 8"/>',
  plug: '<path d="M9 3v4M15 3v4M7 7h10v4a5 5 0 0 1-10 0V7zM12 16v5"/>',
  chevd: '<path d="M7 10l5 5 5-5"/>', chevr: '<path d="M10 7l5 5-5 5"/>', chevl: '<path d="M14 7l-5 5 5 5"/>',
  panel: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M14.5 4.5v15"/>',
  sidebar: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M9.5 4.5v15"/>',
  branch: '<circle cx="6" cy="5.5" r="2"/><circle cx="6" cy="18.5" r="2"/><circle cx="18" cy="8.5" r="2"/><path d="M6 7.5v9M18 10.5c0 4-6 3-11 6"/>',
  file: '<path d="M6 3.5h8l4.5 4.5v12.5H6z"/><path d="M14 3.5V8h4.5"/>',
  term: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M7.5 10l3 2.5-3 2.5M13 15h4"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4.5M12 17.2v.3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  checkc: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16.2 9.7"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 2.5 14.4 0 17M12 3.5c-2.5 2.6-2.5 14.4 0 17"/>',
  refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  shield: '<path d="M12 3.5l7 2.5v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  bolt: '<path d="M13 3L5 13.5h6L10.5 21 19 10.5h-6z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  min: '<rect x="6" y="11.4" width="12" height="1.2" fill="currentColor" stroke="none"/>', max: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  diff: '<path d="M8 4v8M4 8h8M14 17h6M12 3.5l-8 17"/>',
  queue: '<path d="M4 7h11M4 12h11M4 17h7M18 14v6M15 17h6"/>',
  steer: '<path d="M4 12h9M10 7l5 5-5 5M19 5v14"/>',
  key: '<circle cx="8" cy="15" r="3.5"/><path d="M10.5 12.5L19 4M16 7l2 2M14 9l1.5 1.5"/>',
  dl: '<path d="M12 4v11M7 10l5 5 5-5M5 19.5h14"/>',
  copy: '<rect x="8" y="8" width="11.5" height="11.5" rx="2"/><path d="M5 15.5V6a1.5 1.5 0 0 1 1.5-1.5H16"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="2.5"/><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5"/>',
  sparkle: '<path d="M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  lang: '<path d="M4 6h9M8.5 4v2M6 6c.5 3 2.5 5.5 5.5 6.5M11 6c-.6 3.5-3 6.5-6.5 7.5M13 20l3.5-8 3.5 8M14.2 17.3h4.6"/>',
  power: '<path d="M12 3.5v7.5M7 6.5a7.5 7.5 0 1 0 10 0"/>',
  island: '<rect x="3" y="8" width="18" height="8" rx="4"/>',
};
export const ic = (n, s = 18, c = T.dim, w = 1.8) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block">${P[n].replace(/currentColor/g, c)}</svg>`;

// ---------- engine marks ----------
let gid = 0;
export function clawd(s) {
  // Clawd: pixel critter, terracotta body, black eyes, side arms, four legs
  const o = "#D97757";
  return `<svg width="${s}" height="${s * 16 / 22}" viewBox="0 0 22 16" style="display:block" shape-rendering="crispEdges">
<rect x="3" y="1" width="16" height="10" fill="${o}"/><rect x="0" y="5" width="3" height="3" fill="${o}"/><rect x="19" y="5" width="3" height="3" fill="${o}"/>
<rect x="4" y="11" width="2" height="4" fill="${o}"/><rect x="8" y="11" width="2" height="4" fill="${o}"/><rect x="12" y="11" width="2" height="4" fill="${o}"/><rect x="16" y="11" width="2" height="4" fill="${o}"/>
<rect x="7" y="4" width="2" height="3" fill="#1A1A1A"/><rect x="13" y="4" width="2" height="3" fill="#1A1A1A"/></svg>`;
}
export function gemini(s) {
  const id = "gm" + gid++;
  const star = "M12 0C12.6 6.4 17.6 11.4 24 12C17.6 12.6 12.6 17.6 12 24C11.4 17.6 6.4 12.6 0 12C6.4 11.4 11.4 6.4 12 0Z";
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" style="display:block"><defs>
<clipPath id="${id}c"><path d="${star}"/></clipPath>
<radialGradient id="${id}r" cx="12" cy="12" r="12" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#FFFFFF" stop-opacity=".55"/><stop offset=".55" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient></defs>
<g clip-path="url(#${id}c)"><rect x="0" y="0" width="12" height="12" fill="#4285F4"/><rect x="12" y="0" width="12" height="12" fill="#EA4335"/><rect x="12" y="12" width="12" height="12" fill="#FBBC04"/><rect x="0" y="12" width="12" height="12" fill="#34A853"/><rect x="0" y="0" width="24" height="24" fill="url(#${id}r)"/></g></svg>`;
}
export function av(e, s = 32, extra = "") {
  const r = Math.round(s * 0.28);
  const st = `width:${s}px;height:${s}px;border-radius:${r}px;flex:none;display:flex;align-items:center;justify-content:center;overflow:hidden;${extra}`;
  if (e === "codex") return `<div style="${st};background:${ENG.codex.tile}"><img src="${codexPng}" style="width:${s * 0.84}px;height:${s * 0.84}px;display:block"></div>`;
  if (e === "claude" || e === "sonnet") return `<div style="${st};background:${ENG[e].tile};position:relative">${clawd(s * 0.74)}${s >= 26 ? `<span style="position:absolute;right:${s * 0.06}px;bottom:${s * 0.05}px;font-size:${Math.max(7, s * 0.24)}px;font-weight:800;line-height:1;color:${e === "claude" ? "#B4532F" : "#9A6A12"}">${e === "claude" ? "O" : "S"}</span>` : ""}</div>`;
  if (e === "gemini") return `<div style="${st};background:${ENG.gemini.tile}"><img src="${geminiPng}" style="width:${s * 0.66}px;height:${s * 0.66}px;display:block"></div>`;
  if (e === "antigravity") return `<div style="${st};background:${ENG.antigravity.tile}"><img src="${antigravityPng}" style="width:${s * 0.74}px;height:${s * 0.74}px;display:block"></div>`;
  // an API provider ("api:groq"): its first letter on a colour picked from its id
  if (String(e).startsWith("api:")) {
    const id = String(e).slice(4);
    const hue = [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
    return `<div style="${st};background:hsl(${hue} 55% 42%);font-size:${s * 0.46}px;font-weight:700;color:#fff">${(id[0] ?? "?").toUpperCase()}</div>`;
  }
  return `<div style="${st};background:#3A3A3C;font-size:${s * 0.44}px;font-weight:700;color:#fff">c</div>`;
}
export const stack = (es, s = 26) => `<div class="row">${es.map((e, i) => av(e, s, `${i ? "margin-left:-7px;" : ""}box-shadow:0 0 0 2px #1C1C1E`)).join("")}</div>`;
export const role = (e, r) => `<span class="role" style="background:${hexA(ENG[e].color, 0.16)};color:${ENG[e].color}">${r}</span>`;
export function hexA(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
export const mention = (e, t) => `<span style="color:${ENG[e].color};font-weight:600">@${t}</span>`;
export const wordmark = (s = 19) => `<div class="row" style="gap:${s * 0.4}px;font-size:${s}px;font-weight:800;letter-spacing:-.02em"><img src="${waltPng}" alt="" style="width:${s * 1.25}px;height:${s * 1.25}px;display:block;flex:none">Walt</div>`;
export const dot = (c, s = 8) => `<span style="width:${s}px;height:${s}px;border-radius:${s}px;background:${c};display:block;flex:none"></span>`;

// ---------- shell ----------
export function titlebar(project = "BIBI", bare = false) {
  return `<div class="tb">${ic("chevl", 16, T.faint)}${ic("chevr", 16, T.faint)}${ic("sidebar", 17, T.dim)}
${bare ? "" : `<div class="wsel" data-hot="project switcher"><span style="width:16px;height:16px;border-radius:5px;background:${T.green};display:block"></span>${project}${ic("chevd", 14, T.dim)}</div>`}
<div class="wctl"><span>${ic("min", 14, T.dim, 1.4)}</span><span>${ic("max", 13, T.dim, 1.4)}</span><span>${ic("x", 14, T.dim, 1.4)}</span></div></div>`;
}
export function rail(on = "chat") {
  const it = (n, k, d) => `<div class="ri ${on === k ? "on" : ""}" data-hot="rail:${k}">${ic(n, 20, on === k ? T.text : T.dim)}${d ? '<span class="dot"></span>' : ""}</div>`;
  return `<div class="rail">${it("chat", "chat", true)}${it("grid", "projects")}${it("tasks", "tasks")}${it("memory", "memory")}${it("usage", "usage")}
<div style="flex:1"></div>${it("gear", "settings")}</div>`;
}
const PROC = { busy: ["Working", T.green], warm: ["Ready", T.blue], cold: ["Asleep", T.faint], wait: ["Waiting", T.amber] };
export function sidebar({ room = "main", personas, rooms, task = "T-014" }) {
  rooms = rooms || [
    ["main", "Main", ["codex", "claude", "sonnet", "gemini"], "Codex: running npm test…", "now"],
    ["db", "Database", ["sonnet", "claude"], "Opus: schema looks right", "Fri"],
    ["copy", "Landing copy", ["claude", "gemini"], "Roundtable ended", "Thu"],
  ];
  personas = personas || [["codex", "Builder", "busy", "T-014"], ["claude", "Reviewer", "warm", "waits for r1"], ["gemini", "Reviewer", "cold", "wakes on its turn"], ["sonnet", "Free", "cold", "not on T-014"]];
  personas = personas.length === 3 ? [...personas, ["sonnet", "Free", "cold", "not on T-014"]] : personas;
  return `<div class="side">
<div class="row sb" style="padding:2px 8px 8px">${wordmark()}<div class="row g12">${ic("plus", 18)}${ic("search", 18)}</div></div>
<div class="sect">Rooms · BIBI ${ic("plus", 15)}</div>
${rooms.map(([k, n, es, p, t]) => `<div class="item ${k === room ? "on" : ""}" data-hot="room:${n}">${stack(es, 22)}<div class="f1"><div class="row sb"><span class="t">${n}</span><span class="s12 dim">${t}</span></div><div class="p">${p}</div></div></div>`).join("")}
<div class="sect" style="margin-top:8px">Personas · roles for ${task} ${ic("more", 15)}</div>
${personas.map(([e, r, st, p]) => `<div class="item" data-hot="persona:${ENG[e].name}">${av(e, 36)}<div class="f1"><div class="row sb"><span class="t">${ENG[e].name}</span>${role(e, r)}</div><div class="p row g6">${dot(PROC[st][1], 7)}<span>${PROC[st][0]} · ${p}</span></div></div></div>`).join("")}
<div style="flex:1"></div>
<div class="item" style="background:#1C1C1F"><div class="row g8 s12 dim">${ic("shield", 16, T.green)}<span>4 personas · 3 engines signed in</span></div></div>
</div>`;
}
export function roomHeader({ title = "Main", sub = "BIBI · Library loans app · D:\\Projects\\BIBI", es = ["codex", "claude", "gemini"], inspector = true } = {}) {
  return `<div class="rh"><div class="rtile">${ic("users", 18, T.sub)}</div>
<div class="f1"><div class="s16 b">${title}</div><div class="s12 dim" style="margin-top:2px">${sub}</div></div>
${stack(["cello", ...es], 28)}<div style="width:6px"></div>${ic("plus", 18)}${ic("folder", 18)}${ic("branch", 18)}${ic("panel", 18, inspector ? T.text : T.dim)}${ic("more", 18)}</div>`;
}
export function workflow({ mode = "Triad", stepIdx = 0, steps = ["Build", "Review", "Fix"], status, turn = "1 of 6", controls = true, done = false } = {}) {
  const st = steps.map((s, i) => { const k = i < stepIdx || done ? "done" : i === stepIdx ? "on" : ""; const c = k === "on" ? T.green : k === "done" ? T.dim : T.faint; return `<div class="step ${k}"><svg width="9" height="9" viewBox="0 0 9 9" style="display:block"><circle cx="4.5" cy="4.5" r="3.7" fill="${k ? c : "none"}" stroke="${c}" stroke-width="1.4"/></svg>${s}</div>`; }).join(`<span class="faint">—</span>`);
  return `<div class="wf"><span class="pill" style="background:${hexA(T.blue, 0.18)};color:#9EA6FF">${ic("users", 13, "#9EA6FF")}${mode}</span>${st}
<span class="faint">|</span><span class="sub">${status}</span><div class="f1"></div><span class="dim s12">Turn ${turn}</span>
${controls ? `<span class="btn sm">${ic("pause", 14, T.text)}Pause after turn</span><span class="btn sm r">${ic("stop", 13, "#FF6961")}Stop</span>` : ""}</div>`;
}
export function composer({ text = "", ph = "Message Main, or @mention someone", route = "Template flow · Triad", busy = false, extra = "" } = {}) {
  return `<div class="comp">${extra}<div class="cbox">${ic("plus", 20, T.sub)}
<div class="f1 s15 ${text ? "" : "dim"}" data-hot="composer">${text || ph}${text ? '<span class="cur"></span>' : ""}</div>
${busy ? `<span class="chip">${ic("queue", 14, T.sub)}Queue next</span><span class="chip">${ic("steer", 14, T.sub)}Send now</span>` : ""}
${ic("mic", 19, T.dim)}<div class="send" data-hot="send">${ic("up", 18, "#04170B", 2.2)}</div></div>
<div class="route"><span class="row g6" data-hot="route menu">${ic("users", 14)}<span>${route}</span>${ic("chevd", 13)}</span><span class="faint">·</span>${ic("folder", 14)}<span>Writes: one at a time</span><div class="f1"></div><span class="faint">Enter to send · Shift+Enter new line</span></div></div>`;
}
export const msg = (e, r, time, body, extra = "") => `<div class="msg">${av(e, 32)}<div class="col" style="min-width:0"><div class="mh"><span class="n">${ENG[e].name}</span>${role(e, r)}<span>${time}</span></div><div class="bub">${body}</div>${extra}</div></div>`;
export const mine = (time, body) => `<div class="msg me"><div class="col" style="align-items:flex-end"><div class="mh"><span>${time}</span><span class="n">cello</span></div><div class="bub">${body}</div></div></div>`;
export const handoff = (a, b, t) => `<div class="ho">${ic("arrow", 14, T.faint)}<b>${a}</b>${ic("chevr", 12, T.faint)}<b>${b}</b><span>${t}</span></div>`;
export function shell({ rail: r = "chat", side, main, insp = "", light = false, project }) {
  return `<div class="${light ? "light" : ""}" style="width:100%;height:100%"><div class="win">${titlebar(project)}<div class="bd">${rail(r)}${side ?? ""}<div class="main">${main}</div>${insp}</div></div></div>`;
}
