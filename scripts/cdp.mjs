// Dev helper: drive the running Walt window over the DevTools protocol (start Walt with --remote-debugging-port=9555).
// usage: node scripts/cdp.mjs shot out.png | eval "<js>" | click "<css selector>" | type "<css selector>" "<text>"
import fs from "node:fs";
const [cmd, a, b] = process.argv.slice(2);
const list = await (await fetch("http://127.0.0.1:9555/json/list")).json();
const page = list.find((t) => t.type === "page" && t.url.includes("index.html"));
if (!page) throw new Error("Walt window not found on port 9555");
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
} else if (cmd === "eval") console.log(JSON.stringify(await ev(a), null, 1));
else if (cmd === "click") console.log(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(a)});if(!e)return 'not found';e.click();return 'clicked'})()`));
else if (cmd === "type")
  // React tracks input values through the native setter, so set it that way and fire an input event
  console.log(await ev(`(()=>{const e=document.querySelector(${JSON.stringify(a)});if(!e)return 'not found';const p=Object.getPrototypeOf(e);Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(b)});e.dispatchEvent(new Event('input',{bubbles:true}));return 'typed'})()`));
ws.close();
