import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { overlaps, takeTurn } from "../packages/domain/model";
import { cleanEnv } from "../packages/adapters/environment";
import { manifest } from "../packages/host/files";
import { Store } from "../packages/storage/store";
import { Host } from "../packages/host/service";
import { controlServer } from "../packages/control-api/server";
test("lease roots compare case, separators, parent and sibling correctly", () => {
  assert.equal(overlaps("D:\\Work", "d:/work/sub"), true);
  assert.equal(overlaps("D:/Work", "D:/Workshop"), false);
  assert.equal(overlaps("D:/WORK/", "d:/work"), true);
});
test("turn budget cannot be exceeded", () => {
  const room = { used: 3, budget: 4 } as any;
  takeTurn(room);
  assert.throws(() => takeTurn(room), /exhausted/);
  assert.equal(room.used, 4);
});
test("CLI environment strips credentials and nesting flags", () => {
  const clean = cleanEnv({
    PATH: "safe",
    ANTHROPIC_API_KEY: "secret",
    OPENAI_API_KEY: "secret",
    GEMINI_API_KEY: "secret",
    ANTHROPIC_AUTH_TOKEN: "secret",
    CLAUDECODE: "1",
  });
  assert.deepEqual(clean, { PATH: "safe" });
});
test("manifest changes with file revision and handles Unicode path", async () => {
  const root = await mkdtemp(join(tmpdir(), "walt-é "));
  try {
    await writeFile(join(root, "測試.txt"), "one");
    const a = await manifest(root);
    await writeFile(join(root, "測試.txt"), "two");
    const b = await manifest(root);
    assert.notEqual(a.hash, b.hash);
    assert.equal(Object.keys(b.files).length, 1);
  } finally {
    await rm(root, { recursive: true });
  }
});
test("SQLite restart preserves messages and flags unfinished runs without replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-test-"));
  let store = new Store(dir);
  const state = store.load();
  state.rooms.push({
    id: "r",
    projectId: "p",
    title: "Main",
    template: "direct",
    builder: "sonnet",
    reviewers: [],
    state: "running",
    messages: [],
    used: 1,
    budget: 1,
    step: "build",
    pause: false,
    artifacts: [],
    queue: [],
  });
  store.save(state);
  store.close();
  store = new Store(dir);
  const host = new Host(store);
  assert.equal(host.state.rooms[0].state, "recovery_required");
  assert.equal(host.supervisor.sessions.size, 0);
  await host.close();
  await rm(dir, { recursive: true });
});
test("island rejects browser origins, bad auth and approvals; supports revisions and dedupe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-api-"));
  const host = new Host(new Store(dir));
  const r = host.createRoom.bind(host);
  host.state.projects.push({
    id: "p",
    root: dir,
    name: "Fixture",
    goal: "",
    constraints: "",
  });
  const room = r({
    projectId: "p",
    title: "Main",
    template: "direct",
    builder: "sonnet",
    reviewers: [],
  });
  const api = await controlServer(host, dir, () => {});
  try {
    const { readFile } = await import("node:fs/promises");
    const cfg = JSON.parse(await readFile(join(dir, "control.json"), "utf8"));
    const base = `http://127.0.0.1:${api.port}`;
    const fetch = async (url: string, options: any = {}) => {
      const { Readable } = await import("node:stream");
      const req = Readable.from(options.body ? [options.body] : []);
      Object.assign(req, {
        url: new URL(url).pathname,
        method: options.method || "GET",
        headers: Object.fromEntries(
          Object.entries({
            host: `127.0.0.1:${api.port}`,
            ...options.headers,
          }).map(([k, v]) => [k.toLowerCase(), v]),
        ),
      });
      return await new Promise<{ status: number }>((resolve) => {
        let status = 200;
        const res = {
          writeHead: (code: number) => {
            status = code;
          },
          end: () => resolve({ status }),
        };
        api.server.emit("request", req as any, res as any);
      });
    };
    const headers = {
      Authorization: "Bearer " + cfg.token,
      "Content-Type": "application/json",
    };
    assert.equal((await fetch(base + "/island/v1/state")).status, 401);
    assert.equal(
      (
        await fetch(base + "/island/v1/state", {
          headers: { ...headers, Origin: "http://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/island/v1/asks/a/answer", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
    const body = JSON.stringify({
      commandId: "pause-1",
      expectedRevision: host.state.revision,
    });
    const endpoint = base + "/island/v1/rooms/" + room.id + "/pause";
    assert.equal(
      (await fetch(endpoint, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(room.state, "paused");
    assert.equal(
      (await fetch(endpoint, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ commandId: "pause-2", expectedRevision: 0 }),
        })
      ).status,
      409,
    );
  } finally {
    await api.close();
    await host.close();
    await rm(dir, { recursive: true });
  }
});
import { md } from "../apps/ui/markdown";
test("agent markdown is escaped before formatting", () => {
  const out = md('## Verdict\nUse `a<b` and **bold** <img src=x onerror=alert(1)>\n```js\nif (a < b) return "x";\n```\ndone');
  assert.ok(!out.includes("<img"), "raw HTML must not survive");
  assert.match(out, /<div class="b"[^>]*>Verdict<\/div>/);
  assert.match(out, /<span class="mono"[^>]*>a&lt;b<\/span>/);
  assert.match(out, /<b>bold<\/b>/);
  assert.match(out, /<pre class="mono"[^>]*>if \(a &lt; b\) return &quot;x&quot;;<\/pre>done$/);
  const t = md("See [notes](D:/x/notes.md)\n| A | B |\n|---|:-:|\n| 1 | <b> |\nend");
  assert.match(t, /<span [^>]*title="D:\/x\/notes.md">notes<\/span>/);
  assert.match(t, /<table[^>]*><tr><th[^>]*>A<\/th><th[^>]*>B<\/th><\/tr><tr><td[^>]*>1<\/td><td[^>]*>&lt;b&gt;<\/td><\/tr><\/table>end$/);
});
import { parseMessage } from "../packages/domain/command";
import { DEFAULT_PERSONAS } from "../packages/domain/model";
test("composer shortcuts: @persona, /effort, /model, keep", () => {
  const ps = [...DEFAULT_PERSONAS, { id: "gpt61", name: "GPT 6.1 Sol", engine: "codex" as const, model: "gpt-6.1-sol", strengths: [], avatar: "codex" as const }];
  assert.deepEqual(parseMessage("@Opus use /effort high fix borrow.js", ps), { text: "fix borrow.js", to: "claude", effort: "high", model: undefined, keep: false });
  assert.deepEqual(parseMessage("@claude opus /effort max keep", ps), { text: "", to: "claude", effort: "max", model: undefined, keep: true });
  assert.equal(parseMessage("@GPT 6.1 Sol review this", ps).to, "gpt61");
  assert.equal(parseMessage("ping @sonnet, please", ps).to, "sonnet");
  assert.deepEqual(parseMessage("/model gpt-6.1-sol keep", ps), { text: "", to: undefined, effort: undefined, model: "gpt-6.1-sol", keep: true });
  assert.equal(parseMessage("read src/a.ts and /etc stays text", ps).text, "read src/a.ts and /etc stays text");
  assert.throws(() => parseMessage("@Opus /effort turbo go", ps), /effort needs one of/);
  assert.throws(() => parseMessage("@Opus and @Sonnet both", ps), /one persona/);
  assert.throws(() => parseMessage("@nobody hi", ps), /No persona called @nobody/);
});
test("room settings from the composer: keep, effort per engine, members, custom persona", async () => {
  assert.throws(() => parseMessage("/model a;rm -rf x go", DEFAULT_PERSONAS), /Model id may only use/);
  const dir = await mkdtemp(join(tmpdir(), "walt-cmd-"));
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "T", root: dir, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "Main", template: "build_review", builder: "sonnet", reviewers: ["claude"] });
  await host.send(r.id, "@Opus /effort high keep");
  assert.deepEqual(r.tune?.claude, { effort: "high" });
  assert.equal(r.used, 0, "a settings-only message must not start a run");
  assert.equal(r.messages.at(-1)?.kind, "setting");
  await assert.rejects(host.send(r.id, "@Gemini hi"), /not in this room/);
  host.member(r.id, "gemini", "Member");
  await assert.rejects(host.send(r.id, "@Gemini /effort high hi"), /no effort setting/);
  const gpt = host.savePersona({ name: "GPT 6.1 Sol", engine: "codex", model: "gpt-6.1-sol", effort: "high", strengths: ["Code"], avatar: "codex" });
  host.member(r.id, gpt.id, "Reviewer");
  assert.deepEqual(r.reviewers, ["claude", gpt.id]);
  assert.throws(() => host.deletePersona(gpt.id), /Remove it from Main/);
  assert.throws(() => host.savePersona({ name: "gpt 6.1 sol", engine: "codex", model: "", strengths: [], avatar: "codex" }), /already has that name/);
  await host.close();
  await rm(dir, { recursive: true });
});
import { complete } from "../apps/ui/personas";
test("composer menu: @ names, then effort levels per engine", () => {
  const state: any = { personas: [...DEFAULT_PERSONAS, { id: "gpt", name: "GPT 6.1 Sol", engine: "codex", model: "gpt-6.1-sol", strengths: [], avatar: "codex" }] };
  const room: any = { builder: "sonnet", reviewers: ["claude"], members: ["gpt"] };
  const labels = (t: string) => complete(t, state, room).map((s) => s.label);
  assert.deepEqual(labels("@Op"), ["@Claude Opus"]);
  assert.deepEqual(labels("@GPT 6.1 "), ["@GPT 6.1 Sol"]);
  assert.deepEqual(labels("@Opus /effort "), ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(labels("@GPT 6.1 Sol /effort h"), ["high"]);
  assert.deepEqual(labels("@Gemini /effort "), ["no effort setting"]);
  assert.deepEqual(labels("fix it /ef"), ["/effort"]);
  assert.deepEqual(labels("@Opus fix it"), []);
});
import { codexArgs, userMcpServers, userSkills } from "../packages/adapters/codex";
test("codex runs without the user's MCP servers, plugins or apps", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-codex-"));
  const cfg = join(dir, "config.toml");
  await writeFile(cfg, '[mcp_servers.figcraft]\ncommand = "x"\n[mcp_servers.figcraft.env]\nTOKEN = "secret"\n[mcp_servers.node_repl]\n[plugins."a@b"]\n');
  assert.deepEqual(userMcpServers(cfg), ["figcraft", "node_repl"]);
  const args = codexArgs(userMcpServers(cfg));
  for (const f of ["apps", "plugins", "browser_use", "computer_use", "hooks"]) assert.ok(args.join(" ").includes("--disable " + f), f);
  assert.ok(args.includes("mcp_servers.figcraft.enabled=false") && args.includes("mcp_servers.node_repl.enabled=false"));
  assert.ok(!args.join(" ").includes("secret"));
  assert.equal(args.at(-1), "app-server");
  await mkdir(join(dir, "skills", "ponytail"), { recursive: true });
  await writeFile(join(dir, "skills", "ponytail", "SKILL.md"), "x");
  const skills = userSkills(join(dir, "skills"));
  assert.deepEqual(skills, [join(dir, "skills", "ponytail", "SKILL.md")]);
  assert.ok(codexArgs([], skills).includes(`skills.config=[{path='${skills[0]}',enabled=false}]`));
  await rm(dir, { recursive: true });
});
test("plain chats: no project, model picker target, rename, delete", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-chat-"));
  const host = new Host(new Store(join(dir, "data")));
  const r = host.newChat("");
  assert.equal(r.projectId, "");
  assert.equal(r.template, "direct");
  assert.equal(host.persona(r.builder).engine, "claude");
  assert.ok(host.rootOf(r).includes(join("data", "chats", r.id)), "a projectless chat gets its own folder");
  host.state.catalog = { codex: [{ id: "gpt-6.1-sol", label: "GPT-6.1 Sol", efforts: ["low", "high"] }] };
  host.setTarget(r.id, { engine: "codex", model: "gpt-6.1-sol", effort: "high" });
  assert.equal(host.persona(r.builder).engine, "codex");
  assert.deepEqual(r.tune?.[r.builder], { model: "gpt-6.1-sol", effort: "high" });
  assert.throws(() => host.setTarget(r.id, { engine: "codex", model: "gpt-6.1-sol", effort: "max" }), /accepts effort low, high/);
  assert.throws(() => host.setTarget(r.id, { engine: "codex", model: "nope" }), /not available/);
  assert.equal(host.newChat("").builder, r.builder, "the next chat starts with the last picked model");
  assert.throws(() => host.createRoom({ projectId: "", title: "x", template: "triad", builder: "sonnet", reviewers: ["claude", "codex"] }), /only talk/);
  host.rename(r.id, "  Ide landing page  ");
  assert.equal(r.title, "Ide landing page");
  host.deleteRoom(r.id);
  assert.ok(!host.state.rooms.some((x) => x.id === r.id));
  await host.close();
  await rm(dir, { recursive: true });
});

test("add a model to a team chat: one persona per model, @first word, members", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-team-"));
  const host = new Host(new Store(join(dir, "data")));
  host.state.catalog = { claude: [{ id: "claude-haiku-5-5", label: "Haiku 5.5", efforts: ["low", "high"] }] };
  const a = host.personaFor({ engine: "claude", model: "claude-haiku-5-5" });
  assert.equal(a.name, "Haiku 5.5");
  assert.equal(host.personaFor({ engine: "claude", model: "claude-haiku-5-5" }).id, a.id, "the same model reuses its persona");
  assert.equal(host.personaFor({ engine: "claude", model: "claude-haiku-5-5", effort: "high" }).name, "Haiku 5.5 high");
  assert.throws(() => host.personaFor({ engine: "claude", model: "nope" }), /not available/);
  assert.equal(parseMessage("@Haiku hi", host.state.personas.filter((p) => p.id !== a.id + "x" && p.name !== "Haiku 5.5 high")).to, a.id, "a unique first word is a mention");
  const r = host.newChat("");
  host.member(r.id, a.id, "Member");
  assert.deepEqual(r.members, [a.id]);
  await host.close();
  await rm(dir, { recursive: true });
});

test("a model switched in mid-chat gets the messages it missed", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-recap-"));
  const host = new Host(new Store(join(dir, "data")));
  const r = host.newChat("");
  const claude = r.builder;
  const codex = host.state.personas.find((p) => p.engine === "codex")!.id;
  host.state.catalog = { claude: [{ id: "claude-haiku-5-5", label: "Haiku 5.5", efforts: [] }] };
  const say = (author: string, text: string, model?: string) => (host.message(r, author, text).meta = model ? { model } : undefined);
  say("cello", "Name a colour.");
  say(claude, "Teal.", "claude-haiku-5-5");
  say("cello", "Why?");
  assert.equal(host.unseen(r, claude), "", "it saw everything up to its last reply");
  assert.equal(host.unseen(r, codex), "[User] Name a colour.\n[Haiku 5.5] Teal.", "a new model gets the whole chat so far");
  say(codex, "Because it is calm.");
  say("cello", "And another?");
  assert.equal(host.unseen(r, claude), "[User] Why?\n[Codex] Because it is calm.", "back on Claude: only what came after its last reply");
  await host.close();
  await rm(dir, { recursive: true });
});
