// Dev helper: drive the running Bubble window over the DevTools protocol (start Bubble with --remote-debugging-port=9555).
// usage: node scripts/cdp.mjs shot out.png | reload | drag "x1,y1" "x2,y2" | eval "<js>" | click "<css selector>" | type "<css selector>" "<text>"
import fs from "node:fs";
const [cmd, a, b] = process.argv.slice(2);
const list = await (await fetch("http://127.0.0.1:9555/json/list")).json();
const page = list.find((t) => t.type === "page" && t.url.includes("index.html"));
if (!page) throw new Error("Bubble window not found on port 9555");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); pend.get(m.id)?.(m); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 600));
  return r.result?.result?.value;
};
if (cmd === "shot") {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(a, Buffer.from(r.result.data, "base64"));
  console.log("saved", a);
} else if (cmd === "reload") {
  await send("Page.reload", { ignoreCache: true });
  console.log("reloaded");
} else if (cmd === "drag") {
  // real mouse events: drag "x1,y1" "x2,y2" (CSS pixels)
  const [x1, y1] = a.split(",").map(Number), [x2, y2] = b.split(",").map(Number);
  const m = (type, x, y, buttons) => send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons, clickCount: 1 });
  await m("mouseMoved", x1, y1, 0);
  await m("mousePressed", x1, y1, 1);
  for (let i = 1; i <= 8; i++) await m("mouseMoved", x1 + ((x2 - x1) * i) / 8, y1 + ((y2 - y1) * i) / 8, 1);
  await m("mouseReleased", x2, y2, 0);
  console.log("dragged");
} else if (cmd === "eval") console.log(JSON.stringify(await ev(a), null, 1));
else if (cmd === "click") console.log(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(a)});if(!e)return 'not found';e.click();return 'clicked'})()`));
else if (cmd === "type")
  // React tracks input values through the native setter, so set it that way and fire an input event
  console.log(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(a)});if(!e)return 'not found';const p=Object.getPrototypeOf(e);Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(b)});e.dispatchEvent(new Event('input',{bubbles:true}));return 'typed'})()`));
ws.close();
