// What each AI may use besides the project files: built-in tools (images, web, apps), the user's own plugins and
// MCP servers, found where Claude Code and Codex keep them. Walt only reads these configs; it never writes them.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync, rmSync } from "node:fs";
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
  /** Claude: the connectors of the claude.ai account */
  connectors: boolean;
  /** Customize · Instructions, for every AI */
  instructions: string;
}
export const NO_TOOLS: ToolKit = { images: false, web: false, apps: false, codexPlugins: [], claudePlugins: [], browser: false, computer: false, mcp: [], connectors: false, instructions: "" };
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

/** skills the Claude app synced from claude.ai (~/.claude/skills/synced/<account>/<skill>/SKILL.md). Claude Code does
 * not look that deep, so Walt hands them over as one local plugin. Left out: skills that drive tools only the Claude
 * app has (its browser, Chrome, computer use, the morning brief, Claude Docs). */
const APP_ONLY = new Set(["built-in-browser", "chrome-browser", "computer-use", "morning", "docs"]);
export const synced = { dir: join(tmpdir(), "walt-claude-skills") };
export function syncedSkills(home = homedir()) {
  const root = join(home, ".claude", "skills", "synced");
  try {
    // one folder per account; the app also keeps files there (.bucket-…), which are skipped
    const accounts = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);
    return accounts.flatMap((acct) => {
      let stamp = 0;
      try {
        stamp = JSON.parse(readFileSync(join(root, acct, "manifest.json"), "utf8")).lastUpdated ?? 0;
      } catch {}
      return readdirSync(join(root, acct))
        .filter((n) => !APP_ONLY.has(n) && existsSync(join(root, acct, n, "SKILL.md")))
        .map((name) => ({ name, dir: join(root, acct, name), stamp }));
    });
  } catch {
    return [];
  }
}
/** the plugin folder holding the synced skills, rebuilt when claude.ai syncs again; undefined when there are none */
export function syncedPlugin(home = homedir()) {
  const skills = syncedSkills(home);
  if (!skills.length) return undefined;
  const stamp = JSON.stringify(skills.map((s) => [s.name, s.stamp]));
  const mark = join(synced.dir, ".stamp");
  if (!existsSync(mark) || readFileSync(mark, "utf8") !== stamp) {
    rmSync(synced.dir, { recursive: true, force: true });
    mkdirSync(join(synced.dir, ".claude-plugin"), { recursive: true });
    writeFileSync(join(synced.dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "claude-ai-skills", version: "1.0.0", description: "Skills synced from claude.ai, loaded by Walt" }));
    for (const s of skills) cpSync(s.dir, join(synced.dir, "skills", s.name), { recursive: true });
    writeFileSync(mark, stamp);
  }
  return { id: "claude-ai-skills", name: "Skills from claude.ai", version: skills.map((s) => s.name).join(", "), dir: synced.dir };
}

/** Settings defaults: what most people want on (images, web, apps, plugins, MCP), what can act on the screen off */
export function resolveTools(s: ToolSettings | undefined, mcp: string[]): ToolKit {
  const off = new Set(s?.off ?? []);
  return {
    images: s?.images ?? true,
    web: s?.web ?? true,
    apps: s?.apps ?? true,
    codexPlugins: s?.codexPlugins === false ? [] : codexPlugins().filter((id) => !off.has("codex:" + id)),
    claudePlugins: s?.claudePlugins === false ? [] : [...claudePlugins(), ...[syncedPlugin()].filter((p) => !!p)].filter((p) => !off.has("claude:" + p!.id)) as { id: string; dir: string }[],
    browser: s?.browser ?? false,
    computer: s?.computer ?? false,
    mcp: mcp.filter((n) => !off.has("mcp:" + n)),
    connectors: s?.connectors ?? true,
    instructions: "",
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
