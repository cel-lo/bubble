// The side panel's Browser: open the app you are building (or any web page) next to the chat, then point at
// things on it and ask. Pages run in locked-down <webview>s (see apps/desktop/main.ts: own cookie jar, no Node,
// http(s) only, popups come back here as new tabs). Tabs and the address of each are kept per chat; visited pages
// go to one history for all chats. "Annotate" lets you click any number of things on the page and comment on each;
// "Screenshot" opens the marker on the page as it is. Either way the marked picture, the page address and the notes
// go into your message.
import React, { useEffect, useRef, useState } from "react";
import { ic, T } from "./generated/kit.mjs";
import { t } from "./i18n";
import { burn, type Box } from "./marker";
import { Menu, type Item } from "./menu";

/** what you typed: a local address gets http, something with a dot gets https, anything else is a web search */
export function address(s: string) {
  const v = s.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(v) || /^\d{1,5}$/.test(v)) return "http://" + (/^\d+$/.test(v) ? "localhost:" + v : v);
  if (/^[^\s]+\.[^\s]{2,}$/.test(v)) return "https://" + v;
  return "https://www.google.com/search?q=" + encodeURIComponent(v);
}

/** thin scrollbars that suit Walt's dark panel, on every page (pages that style their own keep theirs) */
const SCROLLBARS = `::-webkit-scrollbar{width:10px;height:10px}::-webkit-scrollbar-track,::-webkit-scrollbar-corner{background:transparent}::-webkit-scrollbar-thumb{background:rgba(128,128,128,.45);border-radius:10px;border:2px solid transparent;background-clip:padding-box}::-webkit-scrollbar-thumb:hover{background-color:rgba(128,128,128,.75)}`;

/** runs inside the page: click things to mark them (numbered), write a comment under each; Walt calls finish() */
const annotate = (placeholder: string) => `(() => {
  if (window.__waltAnno) return;
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647;pointer-events:none";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = '<style>.hl,.mk{position:fixed;border:2px solid #FF453A;border-radius:3px;pointer-events:none}.hl{background:rgba(255,69,58,.10)}.n{position:absolute;left:-11px;top:-11px;width:22px;height:22px;border-radius:11px;background:#FF453A;color:#fff;font:700 12px/22px system-ui,sans-serif;text-align:center}.c{position:fixed;pointer-events:auto;display:flex;gap:2px;background:#2C2C2E;border-radius:10px;padding:4px;box-shadow:0 6px 20px rgba(0,0,0,.5)}.c input{width:210px;border:1px solid #3A3A3C;background:#1C1C1E;color:#F5F5F7;border-radius:7px;padding:5px 8px;font:13px system-ui,sans-serif;outline:none}.c input:focus{border-color:#30C759}.c button{border:0;background:none;color:#909097;cursor:pointer;font:13px system-ui,sans-serif;padding:0 7px}</style><div class="hl" hidden></div>';
  document.documentElement.appendChild(host);
  const hl = root.querySelector(".hl");
  const items = [];
  const ours = (e) => e.composedPath().includes(host);
  const at = (el, r) => Object.assign(el.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" });
  const place = () => items.forEach((it, i) => {
    const r = it.el.getBoundingClientRect();
    at(it.box, r);
    it.num.textContent = i + 1;
    Object.assign(it.card.style, { left: Math.max(4, Math.min(innerWidth - 270, r.left)) + "px", top: Math.max(4, Math.min(innerHeight - 44, r.bottom + 6)) + "px" });
  });
  const stop = (e) => { if (!ours(e)) { e.preventDefault(); e.stopPropagation(); } };
  const move = (e) => { if (ours(e)) return void (hl.hidden = true); hl.hidden = false; at(hl, e.target.getBoundingClientRect()); };
  const click = (e) => {
    if (ours(e)) return;
    stop(e);
    const box = document.createElement("div"), num = document.createElement("span"), card = document.createElement("div"), input = document.createElement("input"), x = document.createElement("button");
    box.className = "mk"; num.className = "n"; card.className = "c";
    input.placeholder = ${JSON.stringify(placeholder)};
    x.textContent = "\\u2715";
    box.append(num); card.append(input, x);
    // typing a comment must not trigger the page's own keyboard shortcuts
    for (const k of ["keydown", "keyup", "keypress", "input"]) input.addEventListener(k, (ev) => ev.stopPropagation());
    input.addEventListener("keydown", (ev) => (ev.key === "Enter" || ev.key === "Escape") && input.blur());
    const it = { el: e.target, box, num, card, input };
    x.onclick = () => { box.remove(); card.remove(); items.splice(items.indexOf(it), 1); place(); };
    root.append(box, card);
    items.push(it);
    place();
    input.focus();
  };
  const path = (el) => { const out = []; while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && out.length < 4) { let s = el.tagName.toLowerCase(); if (el.id) { out.unshift(s + "#" + el.id); break; } const c = [...el.classList].slice(0, 2).join("."); if (c) s += "." + c; out.unshift(s); el = el.parentElement; } return out.join(" > "); };
  const on = [["mousemove", move], ["click", click], ["mousedown", stop], ["mouseup", stop], ["pointerdown", stop], ["pointerup", stop], ["scroll", place], ["resize", place]];
  for (const [k, f] of on) addEventListener(k, f, true);
  const end = () => { for (const [k, f] of on) removeEventListener(k, f, true); host.remove(); delete window.__waltAnno; };
  window.__waltAnno = {
    finish: () => {
      const vw = innerWidth, vh = innerHeight;
      const out = items.map((it) => { const r = it.el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, note: it.input.value.trim(), path: path(it.el), text: String(it.el.innerText || it.el.value || it.el.alt || "").trim().replace(/\\s+/g, " ").slice(0, 80) }; });
      end();
      return { items: out, vw, vh };
    },
    cancel: end,
  };
})()`;

/** what the marker gets: the page picture, boxes to start with, and the heading for the notes */
export interface Shot { src: string; boxes: Box[]; title: string }
/** a marked picture that goes straight into the message */
export interface Attach { png: string; title: string; notes: string[] }

interface Tab { id: string; start: string; url: string; title: string; back?: boolean; fwd?: boolean; loading?: boolean; found?: string }
interface Visit { url: string; title: string; at: number }
const HISTORY = "walt.browser.history";
const store = {
  get<V>(k: string, d: V): V {
    try {
      const v = localStorage.getItem(k);
      return v ? JSON.parse(v) : d;
    } catch {
      return d;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {}
  },
};
/** shortcut: history lives in this window's storage (500 visits), not in Walt's database; move it there if other devices or the AIs need it */
function visit(url: string, title: string) {
  const h = store.get<Visit[]>(HISTORY, []);
  if (h[0]?.url === url) h[0] = { ...h[0], title: title || h[0].title, at: Date.now() };
  else h.unshift({ url, title, at: Date.now() });
  store.set(HISTORY, h.slice(0, 500));
}
const newTab = (start = ""): Tab => ({ id: Math.random().toString(36).slice(2, 10), start, url: start, title: "" });
/** a chat's tabs; older Walt kept one address per chat as a plain string */
function loadTabs(key: string): { tabs: Tab[]; active: string } {
  try {
    const raw = localStorage.getItem(key) || "";
    if (raw && !raw.startsWith("{")) {
      const tab = newTab(raw);
      return { tabs: [tab], active: tab.id };
    }
    const v = raw ? JSON.parse(raw) : null;
    if (v?.tabs?.length) {
      const tabs = v.tabs.map((x: Tab) => ({ ...newTab(x.url), id: x.id, title: x.title }));
      return { tabs, active: tabs.some((x: Tab) => x.id === v.active) ? v.active : tabs[0].id };
    }
  } catch {}
  const tab = newTab();
  return { tabs: [tab], active: tab.id };
}

const Btn = ({ icon, label, onClick, disabled, text, tone }: { icon: string; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; disabled?: boolean; text?: string; tone?: "g" }) => (
  <button type="button" className={text ? `btn sm ${tone ?? ""}` : "tbb"} aria-label={label} title={label} disabled={disabled} onClick={onClick} style={{ border: 0, opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flex: "none", ...(text ? {} : { background: "none" }) }}>
    <span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: ic(icon, 16, tone ? "#fff" : T.sub, 1.9) }} />
    {text}
  </button>
);

/** one tab's page; reports its address, title and history buttons up */
function Page({ tab, active, patch, register }: { tab: Tab; active: boolean; patch: (id: string, p: Partial<Tab>) => void; register: (id: string, v: any) => void }) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    register(tab.id, v);
    const sync = () => patch(tab.id, { back: v.canGoBack(), fwd: v.canGoForward(), loading: v.isLoading() });
    const went = (e: any) => {
      if (e.isMainFrame === false) return;
      patch(tab.id, { url: e.url, back: v.canGoBack(), fwd: v.canGoForward() });
      visit(e.url, v.getTitle());
    };
    const titled = (e: any) => {
      patch(tab.id, { title: e.title });
      visit(v.getURL(), e.title);
    };
    const ready = () => void v.insertCSS(SCROLLBARS).catch(() => {});
    const found = (e: any) => e.result?.finalUpdate && patch(tab.id, { found: `${e.result.activeMatchOrdinal}/${e.result.matches}` });
    const failed = (e: any) => e.isMainFrame && e.errorCode !== -3 && patch(tab.id, { title: t("Could not open {0} ({1})", e.validatedURL, e.errorDescription) });
    const evs: [string, (e: any) => void][] = [["did-navigate", went], ["did-navigate-in-page", went], ["page-title-updated", titled], ["did-start-loading", sync], ["did-stop-loading", sync], ["dom-ready", ready], ["found-in-page", found], ["did-fail-load", failed]];
    for (const [k, f] of evs) v.addEventListener(k, f);
    return () => {
      evs.forEach(([k, f]) => v.removeEventListener(k, f));
      register(tab.id, null);
    };
  }, [!!tab.start]);
  if (!tab.start)
    return (
      <div className="col g8 s13 dim" style={{ padding: 22, lineHeight: 1.5, display: active ? "flex" : "none" }}>
        <span className="s14 b" style={{ color: T.text }}>{t("Open a page next to the chat")}</span>
        <span>{t("Type the address of the app you are building (for example localhost:5173) or any web page. Then annotate what you mean, or take a screenshot, and ask.")}</span>
        <span>{t("Pages here have their own cookies, cannot download files and get no camera, microphone or location.")}</span>
      </div>
    );
  return React.createElement("webview", { ref, src: tab.start, partition: "persist:walt-browser", allowpopups: "true", style: { position: "absolute", inset: 0, background: "#fff", display: active ? "flex" : "none" } });
}

export function BrowserPane({ roomId, hidden }: { roomId: string; hidden: boolean }) {
  const key = "walt.browser." + roomId;
  const [state, setState] = useState(() => loadTabs(key));
  const { tabs, active } = state;
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];
  const [input, setInput] = useState(tab.url);
  const [annotating, setAnnotating] = useState(false);
  const [finding, setFinding] = useState<string | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [note, setNote] = useState("");
  const views = useRef(new Map<string, any>());
  const view = () => views.current.get(active);
  const addr = useRef<HTMLInputElement>(null);
  // remember the chat's tabs (address and title only)
  useEffect(() => store.set(key, { tabs: tabs.map(({ id, url, title }) => ({ id, url, title })), active }), [tabs, active]);
  useEffect(() => setInput(tab.url), [active, tab.url]);
  useEffect(() => {
    if (!note) return;
    const id = setTimeout(() => setNote(""), 5000);
    return () => clearTimeout(id);
  }, [note]);
  const patch = (id: string, p: Partial<Tab>) => setState((s) => ({ ...s, tabs: s.tabs.map((x) => (x.id === id ? { ...x, ...p } : x)) }));
  const register = (id: string, v: any) => (v ? views.current.set(id, v) : views.current.delete(id));
  const open = (url = "") => {
    const n = newTab(url);
    setState((s) => ({ tabs: [...s.tabs, n], active: n.id }));
    if (!url) requestAnimationFrame(() => addr.current?.focus());
  };
  const close = (id: string) =>
    setState((s) => {
      const i = s.tabs.findIndex((x) => x.id === id);
      const rest = s.tabs.filter((x) => x.id !== id);
      if (!rest.length) {
        const n = newTab();
        return { tabs: [n], active: n.id };
      }
      return { tabs: rest, active: s.active === id ? rest[Math.max(0, i - 1)].id : s.active };
    });
  // a popup or target=_blank link from one of this chat's pages opens as a new tab here
  useEffect(
    () =>
      window.walt.browserTab?.(({ url, from }) => {
        if ([...views.current.values()].some((v) => v?.getWebContentsId?.() === from)) open(url);
      }),
    [],
  );
  const go = (to = input) => {
    const u = address(to);
    if (!u) return;
    setHistory(null);
    if (!tab.start) patch(tab.id, { start: u, url: u });
    else void view()?.loadURL(u).catch(() => {});
  };
  const picture = async () => {
    const png = await window.walt.call("browser.capture", view().getWebContentsId()).catch(() => null);
    if (!png) setNote(t("Could not take a picture of this page."));
    return png as string | null;
  };
  const shot = async () => {
    const png = await picture();
    if (png) dispatchEvent(new CustomEvent("walt:mark-shot", { detail: { src: "data:image/png;base64," + png, boxes: [], title: t("On the marked page ({0}):", view().getURL()) } satisfies Shot }));
  };
  const startAnnotating = async () => {
    setFinding(null);
    setHistory(null);
    await view()?.executeJavaScript(annotate(t("Add a comment…"))).catch(() => {});
    setAnnotating(true);
    view()?.focus();
  };
  const cancelAnnotating = () => {
    setAnnotating(false);
    void view()?.executeJavaScript("window.__waltAnno?.cancel()").catch(() => {});
  };
  // everything marked on the page: one picture with numbered boxes, one note line per mark, straight into the message
  const finishAnnotating = async () => {
    const v = view();
    setAnnotating(false);
    const r = await v?.executeJavaScript("window.__waltAnno?.finish()").catch(() => null);
    if (!r?.items?.length) return setNote(t("Nothing was marked."));
    await new Promise((ok) => setTimeout(ok, 120)); // let the page repaint without the marks
    const png = await picture();
    if (!png) return;
    const boxes: Box[] = r.items.map((x: any) => ({ x: x.x / r.vw, y: x.y / r.vh, w: x.w / r.vw, h: x.h / r.vh, note: x.note }));
    const img = new Image();
    img.src = "data:image/png;base64," + png;
    await img.decode();
    const notes = r.items.map((x: any, i: number) => {
      const seen = x.y + x.h > 0 && x.y < r.vh && x.x + x.w > 0 && x.x < r.vw;
      const about = `${t("element")} ${x.path}${x.text ? ` "${x.text}"` : ""}${seen ? "" : ` (${t("scrolled out of the picture")})`}`;
      return `${i + 1}. ${[x.note, about].filter(Boolean).join(" · ")}`;
    });
    dispatchEvent(new CustomEvent("walt:attach", { detail: { png: burn(img, boxes), title: t("On the marked page ({0}):", v.getURL()), notes } satisfies Attach }));
  };
  // Electron: findNext true starts a new search (typing), false moves to the next match (Enter)
  const find = (text: string, next = false) => (text ? view()?.findInPage(text, { findNext: !next }) : view()?.stopFindInPage("clearSelection"));
  const zoom = (d: number) => {
    const v = view();
    if (!v) return;
    const z = d ? Math.min(3, Math.max(0.3, Math.round((v.getZoomFactor() + d) * 10) / 10)) : 1;
    v.setZoomFactor(z);
    setNote(t("Zoom {0}%", Math.round(z * 100)));
  };
  const menuItems = (): Item[] => {
    const on = !!tab.start;
    return [
      { label: t("New tab"), icon: "plus", onSelect: () => open() },
      { label: t("History"), icon: "clock", onSelect: () => setHistory("") },
      { kind: "sep" },
      { label: t("Find in page"), icon: "search", disabled: !on, onSelect: () => setFinding("") },
      { label: t("Zoom in"), icon: "plus", disabled: !on, onSelect: () => zoom(0.1) },
      { label: t("Zoom out"), icon: "min", disabled: !on, onSelect: () => zoom(-0.1) },
      { label: t("Actual size"), disabled: !on, onSelect: () => zoom(0) },
      { kind: "sep" },
      { label: t("Open in your browser"), icon: "arrow", disabled: !on, onSelect: () => void window.walt.call("browser.external", view()?.getURL()).catch(() => {}) },
      { label: t("Developer tools"), icon: "term", disabled: !on, onSelect: () => view()?.openDevTools() },
      { kind: "sep" },
      {
        label: t("Clear browsing data"),
        icon: "x",
        submenu: [
          { kind: "label", label: t("Cookies and logins, cache and history") },
          {
            label: t("Clear everything"),
            danger: true,
            onSelect: async () => {
              await window.walt.call("browser.clear").catch(() => {});
              store.set(HISTORY, []);
              setNote(t("Browsing data cleared."));
            },
          },
        ],
      },
    ];
  };
  const visits = history === null ? [] : store.get<Visit[]>(HISTORY, []).filter((v) => !history || (v.title + " " + v.url).toLowerCase().includes(history.toLowerCase())).slice(0, 200);
  return (
    <div className="col" style={{ flex: 1, minHeight: 0, display: hidden ? "none" : "flex" }}>
      {/* tabs */}
      <div className="row g4" role="tablist" aria-label={t("Browser tabs")} style={{ padding: "6px 8px 0", overflowX: "auto", scrollbarWidth: "none", flex: "none" }}>
        {tabs.map((x) => (
          <div key={x.id} role="tab" aria-selected={x.id === active} title={x.title || x.url || t("New tab")} onClick={() => setState((s) => ({ ...s, active: x.id }))} className="row g6 s12" style={{ flex: "none", maxWidth: 170, padding: "6px 8px 6px 10px", borderRadius: "9px 9px 0 0", cursor: "pointer", background: x.id === active ? T.card : "transparent", color: x.id === active ? T.text : T.dim }}>
            {x.loading && <span style={{ width: 6, height: 6, borderRadius: 3, background: T.green, flex: "none" }} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{x.title || x.url.replace(/^https?:\/\//, "") || t("New tab")}</span>
            <span role="button" aria-label={t("Close tab")} onClick={(e) => (e.stopPropagation(), close(x.id))} style={{ display: "flex", flex: "none" }} dangerouslySetInnerHTML={{ __html: ic("x", 11, T.dim, 2.2) }} />
          </div>
        ))}
        <Btn icon="plus" label={t("New tab")} onClick={() => open()} />
      </div>
      {/* address bar */}
      <div className="row g4" style={{ padding: "6px 8px", background: T.card, flex: "none" }}>
        <Btn icon="back" label={t("Back")} disabled={!tab.back} onClick={() => view()?.goBack()} />
        <Btn icon="arrow" label={t("Forward")} disabled={!tab.fwd} onClick={() => view()?.goForward()} />
        <Btn icon={tab.loading ? "x" : "refresh"} label={t(tab.loading ? "Stop" : "Reload")} disabled={!tab.start} onClick={() => (tab.loading ? view()?.stop() : view()?.reload())} />
        <input
          ref={addr}
          aria-label={t("Address")}
          placeholder={t("localhost:5173, a web address, or a search")}
          value={input}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0, padding: "5px 10px", fontSize: 13 }}
        />
        <Btn icon="more" label={t("More")} onClick={(e) => setMenu(menu ? null : e.currentTarget.getBoundingClientRect())} />
      </div>
      {menu && <Menu at={menu} width={240} items={menuItems()} onClose={() => setMenu(null)} />}
      {/* annotate / screenshot, or the annotating bar */}
      <div className="row g6" style={{ padding: "6px 8px", borderBottom: `1px solid ${T.line2}`, flex: "none", background: annotating ? "#3A2A12" : undefined }}>
        {annotating ? (
          <>
            <span className="s12" style={{ color: T.amber, flex: 1, minWidth: 0 }}>{t("Click everything you mean on the page and comment on each")}</span>
            <Btn icon="x" label={t("Cancel")} text={t("Cancel")} onClick={cancelAnnotating} />
            <Btn icon="check" label={t("Add the marks to your message")} text={t("Done")} tone="g" onClick={() => void finishAnnotating()} />
          </>
        ) : (
          <>
            <Btn icon="chat" label={t("Click things on the page and comment on each, then add them all to your message")} text={t("Annotate")} disabled={!tab.start} onClick={() => void startAnnotating()} />
            <Btn icon="copy" label={t("Take a picture of the page and mark it")} text={t("Screenshot")} disabled={!tab.start} onClick={() => void shot()} />
            {note && <span className="s12 dim" style={{ marginLeft: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{note}</span>}
          </>
        )}
      </div>
      {finding !== null && (
        <div className="row g6" style={{ padding: "6px 8px", borderBottom: `1px solid ${T.line2}`, flex: "none" }}>
          <input
            autoFocus
            aria-label={t("Find in page")}
            placeholder={t("Find in page")}
            value={finding}
            onChange={(e) => (setFinding(e.target.value), find(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") find(finding, true);
              if (e.key === "Escape") (find(""), setFinding(null));
            }}
            style={{ flex: 1, minWidth: 0, padding: "4px 9px", fontSize: 13 }}
          />
          <span className="s12 dim">{finding && tab.found}</span>
          <Btn icon="x" label={t("Close")} onClick={() => (find(""), setFinding(null))} />
        </div>
      )}
      {/* pages (every tab stays loaded), with History over them when open */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        {tabs.map((x) => (
          <Page key={x.id} tab={x} active={x.id === active} patch={patch} register={register} />
        ))}
        {history !== null && (
          <div className="col" style={{ position: "absolute", inset: 0, background: T.side, zIndex: 1 }}>
            <div className="row g6" style={{ padding: "10px 12px" }}>
              <span className="s14 b f1">{t("History")}</span>
              <Btn icon="x" label={t("Close")} onClick={() => setHistory(null)} />
            </div>
            <input autoFocus aria-label={t("Search history")} placeholder={t("Search history")} value={history} onChange={(e) => setHistory(e.target.value)} style={{ margin: "0 12px 8px", padding: "5px 10px", fontSize: 13 }} />
            <div style={{ flex: 1, overflow: "auto", padding: "0 6px 10px" }}>
              {visits.length ? (
                visits.map((v, i) => (
                  <div key={v.url + v.at + i} className="mi" role="button" title={v.url} onClick={() => go(v.url)} style={{ display: "block", padding: "7px 8px", borderRadius: 8, cursor: "pointer" }}>
                    <div className="s13" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.title || v.url}</div>
                    <div className="s12 dim" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {new Date(v.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {v.url.replace(/^https?:\/\//, "")}
                    </div>
                  </div>
                ))
              ) : (
                <div className="s13 dim" style={{ padding: 8 }}>{t("No pages yet.")}</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
