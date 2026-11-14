// Mark a picture before asking about it: drag boxes over it, give each a note. Done draws numbered red boxes into
// a new PNG (the AI sees the marks) and hands the notes back for the message.
import React, { useEffect, useRef, useState } from "react";
import { ic, T } from "./generated/kit.mjs";
import { t } from "./i18n";

/** a box as fractions of the picture; `about` describes a picked page element for the AI */
export interface Box { x: number; y: number; w: number; h: number; note: string; about?: string }
const RED = "#FF453A";

/** draw the boxes and their numbers onto the picture at full size; returns PNG base64 */
export function burn(img: HTMLImageElement, boxes: Box[]) {
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0);
  const line = Math.max(3, Math.round(c.width / 320));
  boxes.forEach((b, i) => {
    const [x, y, w, h] = [b.x * c.width, b.y * c.height, b.w * c.width, b.h * c.height];
    g.strokeStyle = RED;
    g.lineWidth = line;
    g.strokeRect(x, y, w, h);
    const r = line * 4;
    g.fillStyle = RED;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#fff";
    g.font = `bold ${Math.round(r * 1.2)}px Segoe UI, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(String(i + 1), x, y + 1);
  });
  return c.toDataURL("image/png").split(",")[1];
}

export function Marker({ src, start: initial = [], onDone, onClose }: { src: string; start?: Box[]; onDone: (png: string, notes: string[]) => void; onClose: () => void }) {
  const [boxes, setBoxes] = useState<Box[]>(initial);
  const [draft, setDraft] = useState<Box | null>(null);
  const [busy, setBusy] = useState(false);
  const img = useRef<HTMLImageElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const backdrop = useRef(false);
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  // pointer position as a fraction of the picture, so boxes survive any display size
  const at = (e: React.PointerEvent) => {
    const r = img.current!.getBoundingClientRect();
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
  };
  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("input,button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    start.current = at(e);
    setDraft({ ...start.current, w: 0, h: 0, note: "" });
  };
  const move = (e: React.PointerEvent) => {
    if (!start.current) return;
    const p = at(e), s = start.current;
    setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y), note: "" });
  };
  const up = () => {
    if (draft && draft.w > 0.01 && draft.h > 0.01) setBoxes((b) => [...b, draft]);
    start.current = null;
    setDraft(null);
  };
  const done = () => {
    setBusy(true);
    try {
      onDone(burn(img.current!, boxes), boxes.map((b, i) => (b.note.trim() || b.about ? `${i + 1}. ${[b.note.trim(), b.about].filter(Boolean).join(" · ")}` : "")).filter(Boolean));
    } catch {
      setBusy(false);
    }
  };
  const pct = (v: number) => `${v * 100}%`;
  const shown = draft ? [...boxes, draft] : boxes;
  return (
    // closes only on a click that starts and ends on the dark backdrop (a box dragged past the picture must not close it)
    <div className="scrim" role="dialog" aria-modal="true" aria-label={t("Mark the picture")} onPointerDown={(e) => (backdrop.current = e.target === e.currentTarget)} onClick={(e) => backdrop.current && e.target === e.currentTarget && onClose()}>
      <div className="card col g12" style={{ padding: 16, maxWidth: "92vw" }}>
        <div className="row sb g12">
          <span className="s14 b">{t("Mark the picture")}</span>
          <span className="s12 dim">{t("Drag a box over what you mean, then write a note.")}</span>
        </div>
        <div style={{ position: "relative", alignSelf: "center", cursor: "crosshair", touchAction: "none", userSelect: "none" }} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
          <img ref={img} src={src} crossOrigin="anonymous" alt="" draggable={false} style={{ display: "block", maxWidth: "86vw", maxHeight: "70vh", borderRadius: 8 }} />
          {shown.map((b, i) => (
            <div key={i} style={{ position: "absolute", left: pct(b.x), top: pct(b.y), width: pct(b.w), height: pct(b.h), border: `2px solid ${RED}`, borderRadius: 3 }}>
              <span style={{ position: "absolute", left: -11, top: -11, width: 22, height: 22, borderRadius: 11, background: RED, color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
              {b !== draft && (
                <div className="row g6" style={{ position: "absolute", left: 0, top: "100%", marginTop: 6, background: T.card, borderRadius: 10, padding: 4, boxShadow: "0 6px 20px #0008", zIndex: 1 }}>
                  <input
                    autoFocus={i === boxes.length - 1}
                    aria-label={t("Note for mark {0}", i + 1)}
                    placeholder={t("Add a note…")}
                    value={b.note}
                    onChange={(e) => setBoxes((all) => all.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))}
                    style={{ width: 220, padding: "5px 9px", fontSize: 13 }}
                  />
                  <button type="button" className="tbb" aria-label={t("Remove mark {0}", i + 1)} onClick={() => setBoxes((all) => all.filter((_, j) => j !== i))} style={{ border: 0, background: "none" }}>
                    <span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: ic("x", 12, T.dim, 2.4) }} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="row sb" style={{ marginTop: boxes.length ? 34 : 0 }}>
          <span className="s12 dim">{t("Marks: {0}", boxes.length)}</span>
          <div className="row g8">
            <button type="button" className="btn" style={{ border: 0 }} onClick={onClose}>{t("Cancel")}</button>
            <button type="button" className="btn g" style={{ border: 0 }} disabled={!boxes.length || busy} onClick={done}>{t("Add to message")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
