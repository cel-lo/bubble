// What each AI may use besides the project files: built-in tools (images, web, apps), the user's own plugins and
// MCP servers, found where Claude Code and Codex keep them. Walt only reads these configs; it never writes them.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { ToolSettings } from "../domain/model";

/** one session's tools, resolved from Settings · Plugins & tools; reviewers get NO_TOOLS */
export interface ToolKit {
  images: boolean;
  web: boolean;
  apps: boolean;
  codexPlugins: string[];
  claudePlugins: { id: string; dir: string }[];
  browser: boolean;
  computer: boolean;
  mcp: string[];
}
export const NO_TOOLS: ToolKit = { images: false, web: false, apps: false, codexPlugins: [], claudePlugins: [], browser: false, computer: false, mcp: [] };
export const kitKey = (k: ToolKit) => JSON.stringify({ ...k, claudePlugins: k.claudePlugins.map((p) => p.id), mcp: [...k.mcp].sort() });

/** Claude Code plugins that are installed and enabled (~/.claude/plugins/installed_plugins.json + settings.json) */
export function claudePlugins(home = homedir()) {
  try {
    const installed = JSON.parse(readFileSync(join(home, ".claude", "plugins", "installed_plugins.json"), "utf8"));
    let enabled: Record<string, boolean> = {};
    try {
      enabled = JSON.parse(readFileSync(join(home, ".claude", "settings.json"), "utf8")).enabledPlugins ?? {};
    } catch {}
    return Object.entries<any>(installed.plugins ?? installed)
      .filter(([id]) => enabled[id] !== false)
      .map(([id, v]) => {
        const e = Array.isArray(v) ? v[0] : v;
        return { id, name: id.split("@")[0], version: String(e?.version ?? ""), dir: String(e?.installPath ?? "") };
      })
      .filter((p) => p.dir);
  } catch {
    return [];
  }
}

/** Codex plugins switched on in ~/.codex/config.toml ([plugins."name@market"] … enabled = true) */
export function codexPlugins(config = join(homedir(), ".codex", "config.toml")) {
  try {
    const text = readFileSync(config, "utf8");
    return [...text.matchAll(/^\[plugins\."([^"]+)"\]\s*\n((?:(?!\[)[^\n]*\n?)*)/gm)]
      .filter((m) => !/^\s*enabled\s*=\s*false/m.test(m[2]))
      .map((m) => m[1]);
  } catch {
    return [];
  }
}

/** Settings defaults: what most people want on (images, web, apps, plugins, MCP), what can act on the screen off */
export function resolveTools(s: ToolSettings | undefined, mcp: string[]): ToolKit {
  const off = new Set(s?.off ?? []);
  return {
    images: s?.images ?? true,
    web: s?.web ?? true,
    apps: s?.apps ?? true,
    codexPlugins: s?.codexPlugins === false ? [] : codexPlugins().filter((id) => !off.has("codex:" + id)),
    claudePlugins: s?.claudePlugins === false ? [] : claudePlugins().filter((p) => !off.has("claude:" + p.id)),
    browser: s?.browser ?? false,
    computer: s?.computer ?? false,
    mcp: mcp.filter((n) => !off.has("mcp:" + n)),
  };
}

/** where generated images go (the host points this at <data>/images; the window serves them as walt-img://img/<name>) */
export const media = { dir: join(tmpdir(), "walt-images") };
export const IMAGE_EXT = ["png", "jpg", "jpeg", "webp", "gif"];
/** walt-img references in a message: the files, and the text with each picture named instead */
export function attachments(text: string) {
  const files: string[] = [];
  const clean = text.replace(/!\[[^\]\n]*\]\(walt-img:\/\/img\/([\w.-]+\.(?:png|jpe?g|webp|gif))\)/g, (_, name: string) => {
    const file = join(media.dir, name);
    if (existsSync(file)) files.push(file);
    return `[image attached: ${name}]`;
  });
  return { text: clean, files };
}
/** save a picture (generated or attached); returns the Markdown that shows it in the chat */
export function saveImage(name: string, base64: string, alt = "image", ext = "png") {
  const safe = name.replace(/[^\w.-]/g, "_").slice(0, 120) + "." + (IMAGE_EXT.includes(ext) ? ext : "png");
  mkdirSync(media.dir, { recursive: true });
  writeFileSync(join(media.dir, safe), Buffer.from(base64, "base64"));
  return `![${alt.replace(/[[\]\n]/g, " ").slice(0, 200)}](walt-img://img/${safe})`;
}
