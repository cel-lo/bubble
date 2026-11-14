// The side panel's Browser: open the app you are building (or any web page) next to the chat, then point at
// something on it and ask. Pages run in a locked-down <webview> (see apps/desktop/main.ts: own cookie jar, no
// Node, http(s) only). "Pick" lets you click an element; "Screenshot" takes the page as it is; either one opens
// the marker with the page picture, and the marks and notes go into your message with the page address.
import React, { useEffect, useRef, useState } from "react";
import { ic, T } from "./generated/kit.mjs";
import { t } from "./i18n";
import type { Box } from "./marker";

/** what you typed: a local address gets http, something with a dot gets https, anything else is a web search */
export function address(s: string) {
  const v = s.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?(\/|$)/i.test(v) || /^\d{1,5}$/.test(v)) return "http://" + (/^\d+$/.test(v) ? "localhost:" + v : v);
  if (/^[^\s]+\.[^\s]{2,}$/.test(v)) return "https://" + v;
  return "https://www.google.com/search?q=" + encodeURIComponent(v);
}

/** runs inside the page: highlight what the pointer is over, resolve with it on click (null on Escape) */
const PICKER = `new Promise((done) => {
  const box = document.createElement("div");
  box.style.cssText = "position:fixed;z-index:2147483647;pointer-events:none;border:2px solid #FF453A;background:rgba(255,69,58,.12);border-radius:3px";
  document.documentElement.appendChild(box);
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  const move = (e) => { const r = e.target.getBoundingClientRect(); Object.assign(box.style, { left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px" }); };
  const path = (el) => { const out = []; while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement && out.length < 4) { let s = el.tagName.toLowerCase(); if (el.id) { out.unshift(s + "#" + el.id); break; } const c = [...el.classList].slice(0, 2).join("."); if (c) s += "." + c; out.unshift(s); el = el.parentElement; } return out.join(" > "); };
  const end = (v) => { for (const [k, f] of on) removeEventListener(k, f, true); box.remove(); done(v); };
  const click = (e) => { stop(e); const el = e.target, r = el.getBoundingClientRect(); end({ x: r.left, y: r.top, w: r.width, h: r.height, vw: innerWidth, vh: innerHeight, path: path(el), text: String(el.innerText || el.value || el.alt || "").trim().replace(/\\s+/g, " ").slice(0, 80) }); };
  const key = (e) => { if (e.key === "Escape") { stop(e); end(null); } };
  const on = [["mousemove", move], ["click", click], ["keydown", key], ["mousedown", stop], ["mouseup", stop], ["pointerdown", stop], ["pointerup", stop]];
  for (const [k, f] of on) addEventListener(k, f, true);
})`;

/** what the marker gets: the page picture, boxes to start with, and the heading for the notes */
export interface Shot { src: string; boxes: Box[]; title: string }

const Btn = ({ icon, label, onClick, disabled, text }: { icon: string; label: string; onClick: () => void; disabled?: boolean; text?: string }) => (
  <button type="button" className={text ? "btn sm" : "tbb"} aria-label={label} title={label} disabled={disabled} onClick={onClick} style={{ border: 0, opacity: disabled ? 0.35 : 1, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flex: "none", ...(text ? {} : { background: "none" }) }}>
    <span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: ic(icon, 16, T.sub, 1.9) }} />
    {text}
  </button>
);

export function BrowserPane({ roomId, hidden }: { roomId: string; hidden: boolean }) {
  const key = "walt.browser." + roomId;
  const [url, setUrl] = useState(() => {
    try {
      return localStorage.getItem(key) || "";
    } catch {
      return "";
    }
  });
  const [input, setInput] = useState(url);
  const [nav, setNav] = useState({ back: false, fwd: false, loading: false });
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState("");
  const view = useRef<any>(null);
  const first = useRef(url);
  // the webview's own events: address, history buttons, loading
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const sync = () => setNav({ back: v.canGoBack(), fwd: v.canGoForward(), loading: v.isLoading() });
    const went = (e: any) => {
      setInput(e.url);
      setError("");
      try {
        localStorage.setItem(key, e.url);
      } catch {}
      sync();
    };
    const failed = (e: any) => e.isMainFrame && e.errorCode !== -3 && setError(t("Could not open {0} ({1})", e.validatedURL, e.errorDescription));
    const evs: [string, (e: any) => void][] = [["did-navigate", went], ["did-navigate-in-page", went], ["did-start-loading", sync], ["did-stop-loading", sync], ["did-fail-load", failed]];
    for (const [k, f] of evs) v.addEventListener(k, f);
    return () => evs.forEach(([k, f]) => v.removeEventListener(k, f));
  }, [!!url]);
  const go = () => {
    const u = address(input);
    if (!u) return;
    setError("");
    if (!url) {
      first.current = u;
      setUrl(u);
    } else void view.current?.loadURL(u).catch(() => {});
  };
  // a picture of the page; a picked element starts as box 1, described for the AI
  const mark = async (pick: boolean) => {
    const v = view.current;
    if (!v) return;
    let boxes: Box[] = [];
    if (pick) {
      setPicking(true);
      v.focus();
      const el = await v.executeJavaScript(PICKER, true).catch(() => null);
      setPicking(false);
      if (!el) return;
      const about = `${t("element")} ${el.path}${el.text ? ` "${el.text}"` : ""}`;
      boxes = [{ x: el.x / el.vw, y: el.y / el.vh, w: el.w / el.vw, h: el.h / el.vh, note: "", about }];
      await new Promise((r) => setTimeout(r, 120)); // let the page repaint without the highlight
    }
    const png = await window.walt.call("browser.capture", v.getWebContentsId()).catch(() => null);
    if (!png) return setError(t("Could not take a picture of this page."));
    const shot: Shot = { src: "data:image/png;base64," + png, boxes, title: t("On the marked page ({0}):", v.getURL()) };
    dispatchEvent(new CustomEvent("walt:mark-shot", { detail: shot }));
  };
  const cancelPick = () => void view.current?.executeJavaScript(`dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))`).catch(() => {});
  return (
    <div className="col" style={{ flex: 1, minHeight: 0, display: hidden ? "none" : "flex" }}>
      <div className="row g4" style={{ padding: "8px 10px", borderBottom: `1px solid ${T.line2}` }}>
        <Btn icon="back" label={t("Back")} disabled={!nav.back} onClick={() => view.current?.goBack()} />
        <Btn icon="arrow" label={t("Forward")} disabled={!nav.fwd} onClick={() => view.current?.goForward()} />
        <Btn icon={nav.loading ? "x" : "refresh"} label={t(nav.loading ? "Stop" : "Reload")} disabled={!url} onClick={() => (nav.loading ? view.current?.stop() : view.current?.reload())} />
        <input
          aria-label={t("Address")}
          placeholder={t("localhost:5173, a web address, or a search")}
          value={input}
          spellCheck={false}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && go()}
          onFocus={(e) => e.currentTarget.select()}
          style={{ flex: 1, minWidth: 0, padding: "5px 10px", fontSize: 13 }}
        />
      </div>
      <div className="row g4" style={{ padding: "6px 10px", borderBottom: `1px solid ${T.line2}` }}>
        {picking ? (
          <>
            <span className="s12" style={{ color: T.amber, flex: 1 }}>{t("Click what you mean on the page · Esc to cancel")}</span>
            <Btn icon="x" label={t("Cancel")} text={t("Cancel")} onClick={cancelPick} />
          </>
        ) : (
          <>
            <Btn icon="eye" label={t("Pick an element on the page, then ask about it")} text={t("Pick element")} disabled={!url} onClick={() => void mark(true)} />
            <Btn icon="copy" label={t("Take a picture of the page and mark it")} text={t("Screenshot")} disabled={!url} onClick={() => void mark(false)} />
          </>
        )}
      </div>
      {error && <div className="s12" style={{ color: T.red, padding: "6px 12px" }}>{error}</div>}
      {url ? (
        React.createElement("webview", { ref: view, src: first.current, partition: "persist:walt-browser", allowpopups: "true", style: { flex: 1, minHeight: 0, background: "#fff" } })
      ) : (
        <div className="col g8 s13 dim" style={{ padding: 22, lineHeight: 1.5 }}>
          <span className="s14 b" style={{ color: T.text }}>{t("Open a page next to the chat")}</span>
          <span>{t("Type the address of the app you are building (for example localhost:5173) or any web page. Then pick an element or take a screenshot, mark it, and ask.")}</span>
          <span>{t("Pages here have their own cookies, cannot download files and get no camera, microphone or location.")}</span>
        </div>
      )}
    </div>
  );
}
