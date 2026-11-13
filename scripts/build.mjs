import fs from "node:fs";
import path from "node:path";
import { build } from "esbuild";
const root = process.cwd();
fs.mkdirSync("dist/ui", { recursive: true });
fs.mkdirSync("apps/ui/generated", { recursive: true });
let kit = fs.readFileSync("design/kit.mjs", "utf8");
const start = kit.indexOf("export const T");
kit = kit.slice(start);
for (const key of ["codex", "gemini", "walt"])
  kit =
    `const ${key}Png=${JSON.stringify("data:image/png;base64," + fs.readFileSync(`design/assets/${key}.png`).toString("base64"))};\n` +
    kit;
fs.writeFileSync("apps/ui/generated/kit.mjs", kit);
const { CSS } = await import("../design/kit.mjs");
fs.writeFileSync(
  "dist/ui/design.css",
  CSS +
    "\nhtml,body,#root{width:100%;height:100%;overflow:hidden} .tl{overflow:auto}.btn,.chip,[data-hot],.tab,.ri,.send,.wctl span{cursor:pointer}input,textarea,select{font:inherit;color:inherit;background:#232325;border:1px solid #3A3A3C;border-radius:9px;padding:9px 12px;outline:none}input:focus,textarea:focus,select:focus{border-color:#30C759}.tb{-webkit-app-region:drag}.tb [data-hot],.wctl{-webkit-app-region:no-drag}.bub{white-space:pre-wrap;overflow-wrap:anywhere}.cbox textarea{resize:none;border:0;flex:1;min-width:0;background:transparent;padding:12px 0}.btn:focus-visible,[data-hot]:focus-visible{outline:2px solid #30C759}\n" +
    fs.readFileSync("apps/ui/walt.css", "utf8"),
);
await build({
  entryPoints: ["apps/ui/app.tsx"],
  bundle: true,
  format: "iife",
  outfile: "dist/ui/app.js",
  jsx: "automatic",
  sourcemap: true,
});
for (const [entry, outfile] of [
  ["apps/desktop/main.ts", "dist/desktop/main.cjs"],
  ["apps/desktop/preload.ts", "dist/desktop/preload.cjs"],
])
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    external: ["electron"],
    outfile,
  });
// Wrap the host entry to support top-level await in Electron's CommonJS utility process.
await build({
  entryPoints: ["packages/host/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/host/index.mjs",
});
// window, taskbar and tray icon (the installer takes build/icon.ico itself)
fs.copyFileSync("build/icon.ico", "dist/desktop/icon.ico");
fs.writeFileSync(
  "dist/host/index.cjs",
  'import("./index.mjs").catch(e=>{console.error(e);process.exit(1)});',
);
fs.writeFileSync(
  "dist/ui/index.html",
  '<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; img-src \'self\' data:; style-src \'self\' \'unsafe-inline\'; script-src \'self\'"><title>Walt</title><link rel="stylesheet" href="design.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>',
);
console.log(
  "Built Walt desktop, host and UI. Original design sources retained in design/.",
);
