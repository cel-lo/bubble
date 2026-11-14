// Minimal menus in the Walt style: one popover component used for dropdowns, the model picker and row actions.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ic, T } from "./generated/kit.mjs";

export interface Item {
  label?: string;
  hint?: string;
  checked?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onSelect?: () => void;
  submenu?: Item[];
  /** an icon name from the kit, shown before the label */
  icon?: string;
  /** a longer text shown in a panel beside the menu while the item is hovered (skill descriptions) */
  detail?: string;
  /** a section label, or "-" for a separator */
  kind?: "label" | "sep";
}
const Icon = ({ n, c = T.dim, s = 14 }: { n: string; c?: string; s?: number }) => <span style={{ display: "flex" }} dangerouslySetInnerHTML={{ __html: ic(n, s, c, 2) }} />;

/** a popover list anchored to a rect; closes on outside click and Escape */
export function Menu({ at, items, onClose, side = "below", width }: { at: DOMRect; items: Item[]; onClose: () => void; side?: "below" | "above" | "right"; width?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: -9999, top: -9999 });
  const [open, setOpen] = useState<{ i: number; rect: DOMRect } | null>(null);
  const [act, setAct] = useState(-1);
  useLayoutEffect(() => {
    const m = ref.current!.getBoundingClientRect();
    let left = side === "right" ? at.right + 4 : at.left;
    let top = side === "below" ? at.bottom + 6 : side === "above" ? at.top - m.height - 6 : at.top - 5;
    left = Math.min(left, innerWidth - m.width - 8);
    top = Math.max(8, Math.min(top, innerHeight - m.height - 8));
    setPos({ left, top });
  }, [at, side, items.length]);
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".menu")) onClose();
    };
    const key = (e: KeyboardEvent) => {
      const live = items.map((x, i) => [x, i] as const).filter(([x]) => !x.kind && !x.disabled);
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const k = live.findIndex(([, i]) => i === act);
        setAct(live.at((k + (e.key === "ArrowDown" ? 1 : -1) + live.length) % live.length)?.[1] ?? -1);
      } else if (e.key === "Enter" && act >= 0) {
        e.preventDefault();
        pick(act);
      }
    };
    addEventListener("mousedown", down);
    addEventListener("keydown", key);
    return () => {
      removeEventListener("mousedown", down);
      removeEventListener("keydown", key);
    };
  });
  const pick = (i: number, el?: HTMLElement) => {
    const x = items[i];
    if (x.disabled) return;
    if (x.submenu) return setOpen({ i, rect: (el ?? ref.current!.children[i] as HTMLElement).getBoundingClientRect() });
    x.onSelect?.();
    onClose();
  };
  return createPortal(
    <>
      <div ref={ref} className="menu" role="menu" style={{ ...pos, ...(width ? { width } : {}) }}>
        {items.map((x, i) =>
          x.kind === "sep" ? (
            <div key={i} className="msep" />
          ) : x.kind === "label" ? (
            <div key={i} className="mlabel">{x.label}</div>
          ) : (
            <div
              key={i}
              role="menuitem"
              aria-disabled={x.disabled}
              className={`mi ${x.disabled ? "dis" : ""} ${act === i || open?.i === i ? "act" : ""}`}
              style={x.danger ? { color: "#FF6961" } : undefined}
              onMouseEnter={(e) => {
                setAct(i);
                if (x.submenu && !x.disabled) setOpen({ i, rect: e.currentTarget.getBoundingClientRect() });
                else setOpen(null);
              }}
              // a description belongs to the item under the cursor: leaving it (to scroll, or off the menu) hides it
              onMouseLeave={() => !x.submenu && setAct((a) => (a === i ? -1 : a))}
              onClick={(e) => pick(i, e.currentTarget)}
            >
              <span className="ck">{x.checked ? <Icon n="check" c="#F5F5F7" /> : x.icon ? <Icon n={x.icon} s={16} c={T.sub} /> : null}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{x.label}</span>
              {x.hint && <span className="h">{x.hint}</span>}
              {x.submenu && <span className="h" style={{ paddingLeft: x.hint ? 6 : 18 }}><Icon n="chevr" /></span>}
            </div>
          ),
        )}
      </div>
      {open && items[open.i]?.submenu && <Menu at={open.rect} side="right" items={items[open.i].submenu!} onClose={onClose} />}
      {!open && items[act]?.detail && <Detail menu={ref.current} text={items[act].detail!} />}
    </>,
    document.body,
  );
}

/** the hovered item's description, beside the menu (right if there is room, else left), like the Claude app */
function Detail({ menu, text }: { menu: HTMLDivElement | null; text: string }) {
  if (!menu) return null;
  const r = menu.getBoundingClientRect();
  const width = 320;
  const left = r.right + 6 + width < innerWidth ? r.right + 6 : Math.max(8, r.left - width - 6);
  return (
    <div className="menu s12" role="tooltip" style={{ left, top: r.top, width, padding: "10px 12px", lineHeight: 1.5, whiteSpace: "normal", color: T.sub, pointerEvents: "none" }}>
      {text}
    </div>
  );
}

/** a select replacement: button with the current label, menu of options */
export function Dropdown<V extends string>({ value, options, onChange, label, disabled, width = 160 }: {
  value: V; options: { value: V; label: string; hint?: string; disabled?: boolean }[]; onChange: (v: V) => void; label: string; disabled?: boolean; width?: number;
}) {
  const [at, setAt] = useState<DOMRect | null>(null);
  const cur = options.find((o) => o.value === value);
  return (
    <>
      <button type="button" className="dd" aria-label={label} aria-haspopup="menu" disabled={disabled} style={{ width }} onClick={(e) => setAt(at ? null : e.currentTarget.getBoundingClientRect())}>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cur?.label ?? value}</span>
        <Icon n="chevd" />
      </button>
      {at && <Menu at={at} width={Math.max(width, 180)} onClose={() => setAt(null)} items={options.map((o) => ({ label: o.label, hint: o.hint, disabled: o.disabled, checked: o.value === value, onSelect: () => onChange(o.value) }))} />}
    </>
  );
}
