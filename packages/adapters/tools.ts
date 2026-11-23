// What each AI may use besides the project files: built-in tools (images, web, apps), the user's own plugins and
// MCP servers, found where Claude Code and Codex keep them. Bubble only reads these configs; it never writes them.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, cpSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import type { Engine, Quota, ToolSettings } from "../domain/model";

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
 * not look that deep, so Bubble hands them over as one local plugin. Left out: skills that drive tools only the Claude
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
    writeFileSync(join(synced.dir, ".claude-plugin", "plugin.json"), JSON.stringify({ name: "claude-ai-skills", version: "1.0.0", description: "Skills synced from claude.ai, loaded by Bubble" }));
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

/** plan usage as the engines report it; the host points report at its state */
export const usage = { report: (_engine: Engine, _q: Quota) => {} };
/** Codex `account/rateLimits/*`: primary / secondary windows with usedPercent (0–100) */
export function codexQuota(r: any): Quota | undefined {
  const windows = [r?.primary, r?.secondary]
    .filter((w) => w && typeof w.usedPercent === "number")
    .map((w) => ({ mins: Number(w.windowDurationMins) || 0, percent: Math.round(w.usedPercent), resetsAt: Number(w.resetsAt) || 0 }));
  return windows.length ? { windows, limited: !!r.rateLimitReachedType, at: new Date().toISOString() } : undefined;
}
/** Claude's rate_limit_event: unifiedWindows with utilization (0–1) */
const CLAUDE_WINDOWS: Record<string, number> = { five_hour: 300, seven_day: 10080 };
export function claudeQuota(info: any): Quota | undefined {
  const windows = Object.entries<any>(info?.unifiedWindows ?? {})
    .filter(([k, w]) => CLAUDE_WINDOWS[k] && typeof w?.utilization === "number")
    .map(([k, w]) => ({ mins: CLAUDE_WINDOWS[k], percent: Math.round(w.utilization * 100), resetsAt: Number(w.resetsAt) || 0 }));
  return windows.length ? { windows, limited: !!info.status && info.status !== "allowed" && info.status !== "allowed_warning", at: new Date().toISOString() } : undefined;
}

/** a skill's name and description from its SKILL.md front matter (one-line, quoted or folded > | values) */
export function skillInfo(file: string): { name: string; description: string } | undefined {
  try {
    const head = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(file, "utf8").slice(0, 8000))?.[1];
    if (!head) return undefined;
    const field = (k: string) => {
      const m = new RegExp(`^${k}:[ \t]*(.*)$`, "m").exec(head);
      if (!m) return "";
      let v = m[1].trim();
      if (/^[>|][-+]?$/.test(v)) {
        // a block value: the indented lines that follow
        const rest = head.slice(m.index + m[0].length).split(/\r?\n/).slice(1);
        const end = rest.findIndex((l) => /^\S/.test(l));
        v = (end < 0 ? rest : rest.slice(0, end)).join(" ");
      }
      return v.replace(/^(["'])([\s\S]*)\1$/, "$2").replace(/\s+/g, " ").trim();
    };
    const name = field("name");
    return name ? { name, description: field("description") } : undefined;
  } catch {
    return undefined;
  }
}
/** a plugin's skills: <dir>/skills plus the folders its manifest names ("skills": a folder of skills, a skill
 * folder, or a list of either), as Claude Code and Codex read them */
export function pluginSkills(dir: string) {
  let extra: string[] = [];
  for (const m of [".claude-plugin", ".codex-plugin"])
    try {
      const s = JSON.parse(readFileSync(join(dir, m, "plugin.json"), "utf8")).skills;
      extra = [...extra, ...(Array.isArray(s) ? s : typeof s === "string" ? [s] : [])];
    } catch {}
  const found = ["skills", ...extra].flatMap((p) => {
    const one = skillInfo(join(dir, p, "SKILL.md"));
    return one ? [one] : skillsIn(join(dir, p));
  });
  return [...new Map(found.map((s) => [s.name, s])).values()].sort((a, b) => a.name.localeCompare(b.name));
}
/** the skills in a folder of skills (<dir>/<skill>/SKILL.md) */
export function skillsIn(dir: string) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => skillInfo(join(dir, e.name, "SKILL.md")))
      .filter((s): s is { name: string; description: string } => !!s)
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}
/** where Codex keeps an installed plugin: ~/.codex/plugins/cache/<market>/<name>/<newest version> */
export function codexPluginDir(id: string, home = homedir()) {
  const [name, market] = id.split("@");
  const base = join(home, ".codex", "plugins", "cache", market ?? "", name);
  try {
    const v = readdirSync(base).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
    return v ? join(base, v) : undefined;
  } catch {
    return undefined;
  }
}
