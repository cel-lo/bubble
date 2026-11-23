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
test("island rejects browser origins, bad auth and approvals; dedupes commands; answers decisions", async () => {
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
      return await new Promise<{ status: number; json: any }>((resolve) => {
        let status = 200;
        const res = {
          writeHead: (code: number) => {
            status = code;
          },
          end: (data?: string) => resolve({ status, json: data ? JSON.parse(data) : undefined }),
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
          body: JSON.stringify({ commandId: "ask-1", expectedRevision: 0, option: "yes" }),
        })
      ).status,
      403,
      "tool approvals are never answered from the island",
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
          body: JSON.stringify({ commandId: "pause-1", expectedRevision: 0 }),
        })
      ).status,
      409,
      "the same command id with another body is a conflict",
    );
    // a DECISION: question shows up as a decision the island can answer
    host.control(room.id, "resume");
    room.state = "idle";
    room.messages.push({ id: "m1", author: "sonnet", at: new Date().toISOString(), text: "Two ways.\nDECISION: Which **storage**?\n- SQLite\n- JSON file" });
    const state = (await fetch(base + "/island/v1/state", { headers })).json;
    const d = state.needsYou.find((a: any) => a.kind === "decision");
    assert.deepEqual([d.askId, d.title, d.options, d.who], ["decision:" + room.id, "Which storage?", ["SQLite", "JSON file"], "Claude Sonnet"]);
    assert.equal(state.activeRooms[0].waiting, 1);
    (host.supervisor as any).get = async () => ({ run: async () => "ok, SQLite", stop: async () => {} });
    const answer = (option: string, id: string) =>
      fetch(base + "/island/v1/asks/" + encodeURIComponent(d.askId) + "/answer", { method: "POST", headers, body: JSON.stringify({ commandId: id, expectedRevision: 0, option }) });
    assert.equal((await answer("Postgres", "d-0")).status, 400, "only one of the options");
    assert.equal((await answer("SQLite", "d-1")).status, 200);
    const sent = room.messages.find((m) => m.author === "cello")!;
    assert.deepEqual([sent.text, sent.meta?.via], ["SQLite", "island"], "recorded as answered from the island");
    for (let i = 0; i < 800 && (host as any).active.size; i++) await new Promise((ok) => setTimeout(ok, 10));
    assert.equal((await answer("SQLite", "d-2")).status, 400, "already answered");
    // answering from the island turned off: the question shows without options, and answers are refused
    host.state.settings.islandAnswers = false;
    room.messages.push({ id: "m9", author: "sonnet", at: new Date().toISOString(), text: "DECISION: Again?\n- Yes\n- No" });
    const off = (await fetch(base + "/island/v1/state", { headers })).json;
    assert.deepEqual(off.needsYou.find((a: any) => a.kind === "decision").options, []);
    assert.equal((await answer("Yes", "d-3")).status, 403);
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
  assert.deepEqual(parseMessage("@Opus use /effort high fix borrow.js", ps), { text: "fix borrow.js", to: "claude", tos: ["claude"], effort: "high", model: undefined, keep: false });
  assert.deepEqual(parseMessage("@claude opus /effort max keep", ps), { text: "", to: "claude", tos: ["claude"], effort: "max", model: undefined, keep: true });
  assert.equal(parseMessage("@GPT 6.1 Sol review this", ps).to, "gpt61");
  assert.equal(parseMessage("ping @sonnet, please", ps).to, "sonnet");
  assert.deepEqual(parseMessage("/model gpt-6.1-sol keep", ps), { text: "", to: undefined, tos: [], effort: undefined, model: "gpt-6.1-sol", keep: true });
  assert.equal(parseMessage("read src/a.ts and /etc stays text", ps).text, "read src/a.ts and /etc stays text");
  assert.throws(() => parseMessage("@Opus /effort turbo go", ps), /effort needs one of/);
  // two or more in one message, in the order written
  assert.deepEqual(parseMessage("@Sonnet do A and @Opus do B", ps).tos, ["sonnet", "claude"]);
  assert.equal(parseMessage("@Sonnet do A and @Opus do B", ps).text, "do A and do B");
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
  await assert.rejects(host.send(r.id, "@Antigravity hi"), /not in this room/);
  host.member(r.id, "antigravity", "Member");
  await assert.rejects(host.send(r.id, "@Antigravity /effort high hi"), /no effort setting/);
  const gpt = host.savePersona({ name: "GPT 6.1 Sol", engine: "codex", model: "gpt-6.1-sol", effort: "high", strengths: ["Code"], avatar: "codex" });
  host.member(r.id, gpt.id, "Reviewer");
  assert.deepEqual(r.reviewers, ["claude", gpt.id]);
  assert.throws(() => host.deletePersona(gpt.id), /Remove it from Main/);
  assert.throws(() => host.savePersona({ name: "gpt 6.1 sol", engine: "codex", model: "", strengths: [], avatar: "codex" }), /already has that name/);
  await host.close();
  await rm(dir, { recursive: true });
});
import { complete } from "../apps/ui/personas";
test("composer menu: @ names of this chat's members only, then effort levels per engine", () => {
  const state: any = { personas: [...DEFAULT_PERSONAS, { id: "gpt", name: "GPT 6.1 Sol", engine: "codex", model: "gpt-6.1-sol", strengths: [], avatar: "codex" }] };
  const room: any = { builder: "sonnet", reviewers: ["claude"], members: ["gpt"] };
  const labels = (t: string) => complete(t, state, room).map((s) => s.label);
  assert.deepEqual(labels("@Op"), ["@Claude Opus"]);
  // like a group chat: only this chat's models; Antigravity exists as a persona but is not in it
  assert.deepEqual(labels("@Ant"), []);
  assert.deepEqual(labels("@").length, 3);
  assert.deepEqual(labels("@GPT 6.1 "), ["@GPT 6.1 Sol"]);
  assert.deepEqual(labels("@Opus /effort "), ["low", "medium", "high", "xhigh", "max"]);
  assert.deepEqual(labels("@GPT 6.1 Sol /effort h"), ["high"]);
  assert.deepEqual(labels("@Antigravity /effort "), ["no effort setting"]);
  assert.deepEqual(labels("fix it /ef"), ["/effort"]);
  assert.deepEqual(labels("@Opus fix it"), []);
});
import { codexArgs, userMcpServers, userSkills, onlyReads } from "../packages/adapters/codex";
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
  // Plugins & tools on: images, apps, plugins and web search on; browser and computer use stay off; a plugin switched off is named
  const on = codexArgs([], skills, { images: true, web: true, apps: true, codexPlugins: ["a@b"], claudePlugins: [], browser: false, computer: false, mcp: [], connectors: false, instructions: "" }, ["a@b", "c@d"]).join(" ");
  for (const f of ["image_generation", "apps", "plugins"]) assert.ok(!on.includes("--disable " + f), f + " on");
  assert.ok(on.includes("--disable computer_use") && on.includes('web_search="live"') && on.includes('plugins."c@d".enabled=false') && !on.includes("skills.config"));
  assert.ok(onlyReads([{ type: "read" }, { type: "search" }]) && !onlyReads([{ type: "read" }, { type: "unknown" }]) && !onlyReads([]));
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

test("a file over 20 MB in the project is tracked by size, not a failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "walt-big-"));
  await writeFile(join(root, "big.zip"), Buffer.alloc(21 * 1024 * 1024));
  await writeFile(join(root, "a.txt"), "hi");
  const m = await manifest(root);
  assert.match(m.files["big.zip"], /^size:22020096:/);
  await writeFile(join(root, "big.zip"), Buffer.alloc(22 * 1024 * 1024));
  assert.notEqual((await manifest(root)).hash, m.hash, "a changed big file still changes the manifest");
  await rm(root, { recursive: true });
});

test("messages live in their own table and only changed ones are written", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-store-"));
  // data from before the split: messages inside the state row
  const legacy = new Store(dir);
  const s0 = legacy.load();
  s0.rooms.push({ id: "r1", messages: [{ id: "m1", author: "cello", text: "hi", at: "t" }] } as any);
  legacy.db.prepare("INSERT OR REPLACE INTO state VALUES(1,?)").run(JSON.stringify(s0));
  legacy.close();
  const store = new Store(dir);
  const s = store.load();
  assert.equal(s.rooms[0].messages[0].text, "hi", "old data still loads");
  store.save(s);
  const row = (store.db.prepare("SELECT json FROM state").get() as any).json;
  assert.ok(!row.includes('"hi"'), "the state row no longer carries messages");
  assert.equal((store.db.prepare("SELECT count(*) n FROM messages").get() as any).n, 1);
  const writes = () => (store.db.prepare("SELECT total_changes() n").get() as any).n;
  const before = writes();
  store.save(s);
  assert.equal(writes() - before, 1, "unchanged message not rewritten (only the state row)");
  s.rooms[0].messages.push({ id: "m2", author: "claude", text: "hello", at: "t" });
  s.rooms[0].messages[1].text += " there";
  store.save(s);
  store.close();
  const reopened = new Store(dir);
  assert.deepEqual(reopened.load().rooms[0].messages.map((m) => m.text), ["hi", "hello there"], "order and streamed text survive a restart");
  reopened.close();
  const st = new Store(dir);
  const s2 = st.load();
  s2.rooms = [];
  st.save(s2);
  assert.equal((st.db.prepare("SELECT count(*) n FROM messages").get() as any).n, 0, "a deleted chat leaves no messages behind");
  st.close();
  await rm(dir, { recursive: true });
});

import { verdict } from "../packages/host/service";
test("build, review, fix, review again until the reviewers approve", async () => {
  assert.equal(verdict("ok\nVERDICT: APPROVE"), true);
  assert.equal(verdict("**VERDICT:** CHANGES"), false, "Markdown bold around the label still counts");
  assert.equal(verdict("VERDICT: **CHANGES**"), false);
  assert.equal(verdict("no verdict"), undefined);
  const dir = await mkdtemp(join(tmpdir(), "walt-loop-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: ["claude"] });
  let builds = 0, reviews = 0;
  const prompts: string[] = [];
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({
    run: async (prompt: string) => {
      prompts.push(prompt);
      if (def.id === "codex") {
        await writeFile(join(root, "a.txt"), "v" + ++builds);
        return "built v" + builds;
      }
      return ++reviews === 1 ? "a.txt:1 wrong value\nVERDICT: CHANGES" : "looks right\nVERDICT: APPROVE";
    },
    stop: async () => {},
  });
  await host.send(r.id, "write a.txt");
  for (let i = 0; i < 200 && r.step !== "awaiting acceptance" && r.step !== "needs attention"; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(r.step, "awaiting acceptance");
  assert.equal(builds, 2, "one fix round");
  assert.equal(reviews, 2, "reviewed again after the fix");
  assert.equal(r.artifacts.length, 2);
  assert.ok(prompts[2].includes("fix round 1") && prompts[2].includes("a.txt:1 wrong value"), "the builder got the findings");
  const review1 = JSON.parse(prompts[1]), review2 = JSON.parse(prompts[3]);
  assert.deepEqual(review1.artifact.changed, [{ path: "a.txt", content: "v1" }], "the reviewer gets the changed file's text");
  assert.deepEqual(review2.artifact.changed, [{ path: "a.txt", content: "v2" }], "and on re-review, what the fix changed");
  assert.equal(r.used, 4, "build + review + fix + review = the 4-turn budget");
  assert.match(r.messages.at(-1)!.text, /r2 approved by Claude Opus/);
  assert.equal(review1.builderReply, "built v1", "reviewers see the builder's evidence");
  // a build that edits nothing (ran tests, answered) is not reviewed
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({ run: async () => (def.id === "codex" ? "tests pass" : (reviews++, "VERDICT: APPROVE")), stop: async () => {} });
  r.budget += 4;
  r.step = "";
  await host.send(r.id, "run the tests");
  for (let i = 0; i < 200 && r.step !== "awaiting acceptance"; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(reviews, 2, "no review for an unchanged revision");
  assert.match(r.messages.at(-1)!.text, /nothing to review/);
  assert.equal(r.artifacts.length, 2, "a reply that changed no file makes no revision");
  // Accept: a file another chat added since does not block the revision; a change to its own file does
  await writeFile(join(root, "other-chat.txt"), "made elsewhere");
  await writeFile(join(root, "a.txt"), "edited by hand");
  await assert.rejects(host.accept(r.id), /r\d+ is out of date: a\.txt changed after it was made/);
  await writeFile(join(root, "a.txt"), "v2");
  await host.accept(r.id);
  assert.equal(r.artifacts.at(-1)!.accepted, true);
  await host.close();
  await rm(dir, { recursive: true });
});

import { dropRepeats } from "../packages/host/service";
test("a member only reads: it is told so, and a write it tries is refused with a note, not a card", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-ro-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: [] });
  host.member(r.id, "sonnet", "Member");
  const prompts: string[] = [];
  const answers: boolean[] = [];
  (host.supervisor as any).get = async () => ({
    run: async (prompt: string, _delta: unknown, approve: (tool: string, input: unknown) => Promise<boolean>) => {
      prompts.push(prompt);
      answers.push(await approve("Shell", { command: "New-Item Blank.docx" }));
      answers.push(await approve("Edit", { changes: [] }));
      return "could not";
    },
    stop: async () => {},
  });
  await host.send(r.id, "@Claude Sonnet make me an empty Word file");
  for (let i = 0; i < 200 && (r.state === "running" || !answers.length); i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual(answers, [false, false], "both refused");
  assert.equal(host.state.asks.length, 0, "no approval card you cannot answer");
  assert.match(JSON.parse(prompts[0]).readOnly, /only read.*@Codex/, "the member is told it reads only and who can write");
  const notes = r.messages.filter((m) => m.author === "Walt" && /can only read/.test(m.text));
  assert.equal(notes.length, 1, "Walt says why once per turn");
  assert.match(notes[0].text, /Claude Sonnet can only read.*ask @Codex.*make Claude Sonnet a builder/);
  assert.equal(r.artifacts.length, 0);
  await host.close();
  await rm(dir, { recursive: true });
});
test("revisions that repeat the one before, or are trimmed and untouched, are dropped; reviewed or accepted ones stay", () => {
  const a = (revision: number, hash: string, extra = {}) => ({ revision, hash, files: {}, reviews: [], accepted: false, ...extra });
  const kept = dropRepeats([a(1, "x"), a(2, "x"), a(3, "x"), a(4, "y"), a(5, "y", { accepted: true }), a(6, "x")] as any);
  assert.deepEqual(kept.map((k) => k.revision), [1, 4, 5, 6]);
  // the Main chat as it was: r1 trimmed, r2..r6 the same files
  assert.deepEqual(dropRepeats([a(1, "z", { trimmed: true }), a(2, "z"), a(3, "z"), a(4, "z"), a(5, "z"), a(6, "z")] as any), []);
  assert.deepEqual(dropRepeats([a(1, "z", { trimmed: true, accepted: true }), a(2, "w", { trimmed: true, reviews: [{}] })] as any).map((k) => k.revision), [1, 2]);
});
test("continue a chat in the CLI and export its context", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-cli-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "Loans app", constraints: "Keep the API" });
  const r = host.newChat(p.id);
  const resumes: (string | undefined)[] = [];
  (host.supervisor as any).get = async (_room: string, _def: unknown, _root: string, _ro: boolean, _tune: unknown, resume?: string) => {
    resumes.push(resume);
    return { sessionId: "abc-123", run: async () => "hello back", stop: async () => {} };
  };
  assert.throws(() => host.continueInCli(r.id), /has not answered/);
  await host.send(r.id, "hello");
  for (let i = 0; i < 200 && r.state !== "idle"; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(r.sessions?.[`${r.builder}:false`], "abc-123", "the CLI session id is kept on the chat");
  await host.send(r.id, "again");
  for (let i = 0; i < 200 && (r.state !== "idle" || r.messages.length < 4); i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual(resumes, [undefined, "abc-123"], "the next process is told to resume it");
  const launched: string[] = [];
  host.launch = (cmd) => void launched.push(cmd);
  host.supervisor.claude = "C:\tools\claude.exe";
  const out = host.continueInCli(r.id);
  assert.equal(out.command, "claude --resume abc-123");
  assert.equal(launched[0], `start "Walt" /D "${host.rootOf(r)}" "C:\tools\claude.exe" --resume abc-123`);
  r.sessions![`${r.builder}:false`] = "x & calc";
  assert.throws(() => host.continueInCli(r.id), /looks wrong/, "nothing odd reaches the terminal");
  const ex = host.exportContext(r.id);
  assert.ok(ex.path?.endsWith("WALT.md"));
  const md = (await import("node:fs")).readFileSync(ex.path!, "utf8");
  assert.match(md, /Goal: Loans app/);
  assert.match(md, /\*\*You:\*\* hello/);
  assert.ok(host.exportContext(r.id).path, "exporting again overwrites Walt's own file");
  await writeFile(ex.path!, "my notes");
  assert.throws(() => host.exportContext(r.id), /did not write/, "a WALT.md written by someone else is left alone");
  await host.close();
  await rm(dir, { recursive: true });
});

import { Job } from "../packages/adapters/job";
import { spawn as spawnProcess } from "node:child_process";
test("the job ends AI processes and what they started once Walt lets go of it", { skip: process.platform !== "win32" }, async () => {
  const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
  const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
  // a parent that starts a grandchild 1.5 s after it was put in the job, like a CLI starting `npm test`
  const parent = spawnProcess(process.execPath, ["-e", "setTimeout(()=>{const c=require('child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(c.pid)},1500);setInterval(()=>{},1000)"], { stdio: ["ignore", "pipe", "ignore"] });
  const grandchild = new Promise<number>((ok) => parent.stdout!.once("data", (b) => ok(Number(String(b).trim()))));
  const job = new Job();
  job.add(parent.pid);
  const g = await grandchild;
  for (let i = 0; i < 40 && !job.log.some((l) => l === `ok ${parent.pid}`); i++) await wait(100);
  assert.ok(job.log.includes(`ok ${parent.pid}`), "the helper put the process in the job: " + job.log.join(", "));
  assert.ok(alive(parent.pid!) && alive(g), "both run while Walt holds the job");
  job.close(); // what happens when Walt's host exits or crashes: the pipe closes
  for (let i = 0; i < 50 && (alive(parent.pid!) || alive(g)); i++) await wait(100);
  assert.ok(!alive(parent.pid!), "the CLI process ended");
  assert.ok(!alive(g), "and so did the command it started");
});

import { decision } from "../packages/domain/command";
test("the builder can ask you to choose; review waits for your answer", async () => {
  assert.deepEqual(decision("Two ways.\nDECISION: Which storage?\n- SQLite\n- JSON file"), { question: "Which storage?", options: ["SQLite", "JSON file"] });
  assert.deepEqual(decision("**DECISION:** Keep it?\n* yes\n* no"), { question: "Keep it?", options: ["yes", "no"] });
  assert.equal(decision("DECISION: only one?\n- a"), undefined, "a choice needs at least two options");
  assert.equal(decision("DECISION: q\n- a\nsome other text"), undefined, "options must be the last lines");
  const dir = await mkdtemp(join(tmpdir(), "walt-ask-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: ["claude"] });
  let builds = 0, reviews = 0;
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({
    run: async () => {
      if (def.id !== "codex") return ++reviews && "fine\nVERDICT: APPROVE";
      await writeFile(join(root, "a.txt"), "v" + ++builds);
      return builds === 1 ? "Before I go on:\nDECISION: Use SQLite or a JSON file?\n- SQLite\n- JSON file" : "Used SQLite.";
    },
    stop: async () => {},
  });
  const settle = async () => { for (let i = 0; i < 200 && (r.state !== "idle" || !["awaiting decision", "awaiting acceptance", "needs attention"].includes(r.step)); i++) await new Promise((ok) => setTimeout(ok, 10)); };
  await host.send(r.id, "store loans");
  await settle();
  assert.equal(r.step, "awaiting decision");
  assert.equal(reviews, 0, "no review of a half-done revision");
  await host.send(r.id, "SQLite");
  await settle();
  assert.equal(r.step, "awaiting acceptance");
  assert.equal(reviews, 1, "after the answer: build, then review");
  await host.close();
  await rm(dir, { recursive: true });
});

test("team templates: save, replace by name, delete", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-teams-"));
  const host = new Host(new Store(join(dir, "data")));
  const picks = [{ engine: "codex" as const, model: "gpt-6.1-sol", role: "Builder" as const }, { engine: "claude" as const, model: "opus", role: "Reviewer" as const }];
  const a = host.saveTeam({ name: "Web team", talk: false, picks });
  assert.throws(() => host.saveTeam({ name: "x", talk: false, picks: [picks[0]] }), /at least two/);
  assert.throws(() => host.saveTeam({ name: "x", talk: false, picks: [{ ...picks[0], role: "Reviewer" }, picks[1]] }), /at least one builder/);
  const b = host.saveTeam({ name: "web TEAM", talk: true, picks });
  assert.equal(b.id, a.id, "same name replaces the template");
  assert.equal(host.state.teams!.length, 1);
  host.deleteTeam(a.id);
  assert.equal(host.state.teams!.length, 0);
  await host.close();
  await rm(dir, { recursive: true });
});

test("Plugins & tools: on by default for chats, nothing for reviewers, single items switch off", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-tools-"));
  const host = new Host(new Store(join(dir, "data")));
  host.supervisor.claudeMcp = () => ({ demo: { type: "stdio", command: "demo.exe", env: { TOKEN: "secret" } }, other: { type: "stdio", command: "x" } });
  const t = host.tools();
  assert.deepEqual([t.switches.images, t.switches.web, t.switches.apps, t.switches.browser, t.switches.computer], [true, true, true, false, false]);
  assert.ok(t.mcp.some((m) => m.name === "demo" && m.on));
  const kit = (reviewer: boolean) => (host as any).kit(reviewer);
  assert.ok(kit(false).mcp.includes("demo") && kit(false).images && kit(false).web, "a chat gets everything that is on");
  assert.deepEqual(kit(true).mcp, [], "a reviewer gets no MCP");
  assert.equal(kit(true).images || kit(true).web || kit(true).apps, false, "and no outside tools");
  host.setTool("mcp:demo", false);
  host.setTool("images", false);
  assert.ok(!kit(false).mcp.includes("demo") && kit(false).mcp.includes("other"));
  assert.equal(kit(false).images, false);
  assert.throws(() => host.setTool("rm -rf", true), /Unknown/);
  const file = (host.supervisor as any).claudeMcpFile(["demo"]);
  const cfg = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(cfg.mcpServers), ["demo"], "Claude gets only the servers that are on");
  assert.equal((host.supervisor as any).claudeMcpFile([]), undefined, "none on: Claude keeps its empty MCP config");
  await host.close();
  await rm(dir, { recursive: true });
});

test("after an interrupted run, I checked unlocks the chat and its project", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-rec-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const data = join(dir, "data");
  let host = new Host(new Store(data));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.newChat(p.id);
  r.state = "running"; // Walt went away mid-run
  host.commit();
  await host.close();
  host = new Host(new Store(data));
  const again = host.room(r.id);
  assert.equal(again.state, "recovery_required");
  await assert.rejects(host.send(again.id, "hi"), /Resolve recovery/);
  assert.throws(() => host.control(again.id, "resume"), /I checked/);
  host.control(again.id, "recovered");
  assert.equal(again.state, "idle");
  const other = host.newChat(p.id);
  assert.ok(!(host as any).leases.has(host.state.projects[0].root), "the project lock is released");
  assert.equal(other.state, "idle");
  await host.close();
  await rm(dir, { recursive: true });
});
import { ClaudeSession } from "../packages/adapters/claude";
test("Claude gets Bash only as a builder with the shell setting on", async () => {
  const tools = (readonly: boolean, shell: boolean) => {
    const s = new ClaudeSession(process.execPath, tmpdir(), "", readonly, undefined, undefined, undefined, shell);
    (s as any).ready.catch(() => {});
    // the fake CLI (node) exits at once; writes to its closed stdin must not leak past the test
    (s as any).child.stdin.on("error", () => {});
    const args: string[] = (s as any).child.spawnargs;
    (s as any).child.kill();
    return args[args.indexOf("--tools") + 1];
  };
  assert.equal(tools(false, false), "Read,Glob,Grep,Write,Edit");
  assert.equal(tools(false, true), "Read,Glob,Grep,Write,Edit,Bash,PowerShell");
  assert.equal(tools(true, true), "Read,Glob,Grep");
});
import { autoBuilder } from "../packages/domain/command";
import { defaultStrengths } from "../packages/domain/model";
test("Auto roles pick the builder whose Good at fits the task; ties keep the builder", () => {
  const team = [
    { id: "opus", strengths: defaultStrengths("claude", "opus") },
    { id: "codex", strengths: defaultStrengths("codex", "gpt-6") },
    { id: "sonnet", strengths: defaultStrengths("claude", "sonnet") },
  ];
  assert.equal(autoBuilder("add tests for the parser", team, "opus").id, "codex");
  assert.equal(autoBuilder("plan the migration to sqlite", team, "codex").id, "opus");
  assert.equal(autoBuilder("rewrite the README docs", team, "codex").id, "sonnet");
  assert.equal(autoBuilder("hello there", team, "opus").id, "opus");
  assert.equal(autoBuilder("fix the bug", team, "codex").id, "codex");
});
import { existsSync as fileExists } from "node:fs";
import { execFileSync } from "node:child_process";
test("diff shows what the latest revision changed; backup copies the database", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-diff-"));
  const root = join(dir, "proj");
  await mkdir(root);
  await writeFile(join(root, "keep.txt"), "same");
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: ["claude"] });
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({
    run: async () => (def.id === "codex" ? (await writeFile(join(root, "new.txt"), "one\ntwo"), "made new.txt") : "VERDICT: APPROVE"),
    stop: async () => {},
  });
  await host.send(r.id, "add new.txt");
  for (let i = 0; i < 200 && r.step !== "awaiting acceptance"; i++) await new Promise((ok) => setTimeout(ok, 10));
  const d = await host.diff(r.id);
  assert.equal(d.revision, 1);
  assert.deepEqual(d.files.map((f) => [f.path, f.status]), [["new.txt", "added"]], "unchanged files are left out");
  assert.equal(d.files[0].patch, "+one\n+two", "no git: the new text as added lines");
  // a git project: the real diff against HEAD
  const git = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: root });
  git("init", "-q");
  git("add", "-A");
  git("commit", "-qm", "base");
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({
    run: async () => (def.id === "codex" ? (await writeFile(join(root, "keep.txt"), "changed"), "edited keep.txt") : "VERDICT: APPROVE"),
    stop: async () => {},
  });
  r.budget += 2;
  await host.send(r.id, "edit keep.txt");
  for (let i = 0; i < 300 && r.artifacts.length < 2; i++) await new Promise((ok) => setTimeout(ok, 10));
  for (let i = 0; i < 300 && r.step !== "awaiting acceptance"; i++) await new Promise((ok) => setTimeout(ok, 10));
  const g = await host.diff(r.id);
  assert.deepEqual(g.files.map((f) => [f.path, f.status]), [["keep.txt", "changed"]]);
  assert.match(g.files[0].patch, /^-same$/m);
  assert.match(g.files[0].patch, /^\+changed$/m);
  const b = host.backup();
  assert.ok(fileExists(b.file) && host.backups().length === 1);
  await host.close();
  await rm(dir, { recursive: true });
});

import { usageLimit } from "../packages/domain/command";
test("a usage limit becomes a card, and another model takes the message again", async () => {
  assert.deepEqual(usageLimit("You've hit your usage limit. Upgrade to Pro or try again at 3:05 PM."), { reset: "3:05 PM" });
  assert.deepEqual(usageLimit("5-hour limit reached ∙ resets 3pm (Asia/Jakarta)"), { reset: "3pm" });
  assert.ok(usageLimit("Claude AI usage limit reached|1763049600")?.reset?.startsWith("2025-11-"));
  assert.equal(usageLimit("ENOENT: claude.exe not found"), undefined);
  const dir = await mkdtemp(join(tmpdir(), "walt-limit-"));
  const host = new Host(new Store(join(dir, "data")));
  const r = host.newChat("");
  host.setTarget(r.id, { engine: "claude", model: "default" });
  const ran: string[] = [];
  (host.supervisor as any).get = async (_room: string, def: { engine: string }) => ({
    run: async (prompt: string) => {
      ran.push(def.engine + ": " + prompt.split("\n").at(-1));
      if (def.engine === "claude") throw new Error("You've hit your usage limit. Try again at 3:05 PM.");
      return "done by codex";
    },
    stop: async () => {},
  });
  const idle = async () => { for (let i = 0; i < 800 && (host as any).active.size; i++) await new Promise((ok) => setTimeout(ok, 10)); };
  await host.send(r.id, "write the plan");
  await idle();
  const card = r.messages.at(-1)!;
  assert.equal(card.kind, "limit");
  assert.equal(card.meta?.reset, "3:05 PM");
  await host.handOff(r.id, "codex:default");
  await idle();
  assert.deepEqual(ran, ["claude: write the plan", "codex: write the plan"], "the same message, now to Codex");
  assert.equal(r.messages.at(-1)!.text, "done by codex");
  await assert.rejects(() => host.handOff(r.id, "claude:default"), /no usage limit/);
  await host.close();
  await rm(dir, { recursive: true });
});
import { attachments, media } from "../packages/adapters/tools";
test("pictures: Walt's own show in the chat, attached ones go to the AI with your message", async () => {
  assert.match(md("look ![cat](walt-img://img/a-1.png)"), /<img class="gen" src="walt-img:\/\/img\/a-1.png"/);
  assert.doesNotMatch(md("![x](https://evil.example/p.png)"), /<img/, "no remote images");
  assert.doesNotMatch(md("![x](walt-img://img/../../secret.png)"), /<img/, "no paths");
  const dir = await mkdtemp(join(tmpdir(), "walt-pics-"));
  const host = new Host(new Store(join(dir, "data")));
  assert.equal(media.dir, join(dir, "data", "images"));
  const saved = host.saveAttachment(Buffer.from("png").toString("base64"), "png");
  assert.throws(() => host.saveAttachment("AAAA", "exe"), /PNG/);
  const parsed = attachments(`what is this?\n\n${saved.markdown}\n\n![gone](walt-img://img/missing.png)`);
  assert.deepEqual(parsed.files, [join(media.dir, saved.name)], "only files that exist");
  assert.match(parsed.text, /\[image attached: /);
  const r = host.newChat("");
  const seen: { prompt: string; images: string[] }[] = [];
  (host.supervisor as any).get = async () => ({ run: async (prompt: string, _d: unknown, _a: unknown, images: string[]) => (seen.push({ prompt, images }), "a cat"), stop: async () => {} });
  await host.send(r.id, `what is this?\n\n${saved.markdown}`);
  for (let i = 0; i < 800 && (host as any).active.size; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual(seen[0].images, [join(media.dir, saved.name)]);
  assert.ok(!seen[0].prompt.includes("walt-img://"), "the prompt names the picture instead of linking it");
  await host.close();
  await rm(dir, { recursive: true });
});
import { syncedPlugin, synced } from "../packages/adapters/tools";
test("claude.ai skills become one plugin; connectors, skills and instructions reach Claude", async () => {
  const home = await mkdtemp(join(tmpdir(), "walt-home-"));
  const acct = join(home, ".claude", "skills", "synced", "acct");
  for (const n of ["docx", "chrome-browser"]) {
    await mkdir(join(acct, n), { recursive: true });
    await writeFile(join(acct, n, "SKILL.md"), "---\nname: " + n + "\n---\n");
  }
  await writeFile(join(acct, "manifest.json"), '{"lastUpdated":1}');
  await writeFile(join(home, ".claude", "skills", "synced", ".bucket-acct"), "x"); // the app keeps files there too
  synced.dir = join(home, "out");
  const p = syncedPlugin(home)!;
  const { readdirSync, existsSync } = await import("node:fs");
  assert.deepEqual(readdirSync(join(p.dir, "skills")), ["docx"], "skills for tools only the Claude app has are left out");
  assert.ok(existsSync(join(p.dir, ".claude-plugin", "plugin.json")));
  const args = (kit: any) => {
    const s = new ClaudeSession(process.execPath, tmpdir(), "", false, undefined, undefined, undefined, false, kit);
    (s as any).ready.catch(() => {});
    (s as any).child.stdin.on("error", () => {});
    const a: string[] = (s as any).child.spawnargs;
    (s as any).child.kill();
    return a;
  };
  const on = args({ images: false, web: false, apps: false, codexPlugins: [], claudePlugins: [{ id: "x", dir: p.dir }], browser: false, computer: false, mcp: [], connectors: true, instructions: "Answer in Indonesian." });
  assert.ok(!on.includes("--strict-mcp-config") && !on.includes("--disable-slash-commands") && on.includes("Skill" ) === false);
  assert.ok(on.join(" ").includes("Skill") && on.includes("--plugin-dir") && on[on.indexOf("--append-system-prompt") + 1] === "Answer in Indonesian.");
  const off = args({ images: false, web: false, apps: false, codexPlugins: [], claudePlugins: [], browser: false, computer: false, mcp: [], connectors: false, instructions: "" });
  assert.ok(off.includes("--strict-mcp-config") && off.includes("--disable-slash-commands") && !off.includes("--append-system-prompt"), "a reviewer stays closed");
  await rm(home, { recursive: true });
});
test("every message is a new task with fresh turns: a team chat never gets stuck on its budget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-budget-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: ["claude"] });
  let n = 0;
  (host.supervisor as any).get = async (_room: string, def: { id: string }) => ({
    run: async () => (def.id === "codex" ? (await writeFile(join(root, "a.txt"), "v" + ++n), "built") : "VERDICT: APPROVE"),
    stop: async () => {},
  });
  r.used = r.budget; // as if the last task used every turn
  await host.send(r.id, "first task");
  for (let i = 0; i < 800 && (host as any).active.size; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(r.used, 2, "build + review, counted from 0");
  await host.send(r.id, "second task");
  for (let i = 0; i < 800 && (host as any).active.size; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(n, 2, "the second message ran too");
  await host.close();
  await rm(dir, { recursive: true });
});

import { codexQuota, claudeQuota } from "../packages/adapters/tools";
test("plan usage from Codex and Claude reports", () => {
  const c = codexQuota({ primary: { usedPercent: 6, windowDurationMins: 300, resetsAt: 1794598517 }, secondary: { usedPercent: 20, windowDurationMins: 10080, resetsAt: 1795071380 }, rateLimitReachedType: null });
  assert.deepEqual(c?.windows, [{ mins: 300, percent: 6, resetsAt: 1794598517 }, { mins: 10080, percent: 20, resetsAt: 1795071380 }]);
  assert.equal(c?.limited, false);
  const q = claudeQuota({ status: "rejected", unifiedWindows: { five_hour: { utilization: 0.46, resetsAt: 1794604200 }, seven_day: { utilization: 1, resetsAt: 1794657600 }, unknown_window: { utilization: 0.1 } } });
  assert.deepEqual(q?.windows.map((w) => [w.mins, w.percent]), [[300, 46], [10080, 100]]);
  assert.equal(q?.limited, true);
  assert.equal(claudeQuota({ status: "allowed_warning", unifiedWindows: { five_hour: { utilization: 0.9 } } })?.limited, false);
  assert.equal(codexQuota(undefined), undefined);
  assert.equal(claudeQuota({}), undefined);
});

import { skillInfo, skillsIn, pluginSkills } from "../packages/adapters/tools";
test("skills for the + menu: name and description from SKILL.md", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-skills-"));
  await mkdir(join(dir, "b-one"), { recursive: true });
  await writeFile(join(dir, "b-one", "SKILL.md"), '---\nname: zeta\ndescription: "Makes things: fast"\n---\nbody');
  await mkdir(join(dir, "a-two"), { recursive: true });
  await writeFile(join(dir, "a-two", "SKILL.md"), "---\r\nname: alpha\r\ndescription: >\r\n  Folded text\r\n  over lines\r\nlicense: x\r\n---\r\n");
  await mkdir(join(dir, "empty"), { recursive: true });
  assert.deepEqual(skillsIn(dir), [{ name: "alpha", description: "Folded text over lines" }, { name: "zeta", description: "Makes things: fast" }]);
  assert.equal(skillInfo(join(dir, "nope", "SKILL.md")), undefined);
  assert.deepEqual(skillsIn(join(dir, "missing")), []);
  // a manifest can name other skill folders (a folder of skills, or one skill)
  const plug = join(dir, "plug");
  await mkdir(join(plug, ".claude-plugin"), { recursive: true });
  await writeFile(join(plug, ".claude-plugin", "plugin.json"), JSON.stringify({ skills: ["./paper"] }));
  await mkdir(join(plug, "paper"), { recursive: true });
  await writeFile(join(plug, "paper", "SKILL.md"), "---\nname: paper\ndescription: Write papers\n---\n");
  await mkdir(join(plug, "skills", "lint"), { recursive: true });
  await writeFile(join(plug, "skills", "lint", "SKILL.md"), "---\nname: lint\ndescription: Lint\n---\n");
  assert.deepEqual(pluginSkills(plug).map((x) => x.name), ["lint", "paper"]);
  // the string form, pointing at a folder of skills
  await writeFile(join(plug, ".claude-plugin", "plugin.json"), JSON.stringify({ skills: "./more/" }));
  await mkdir(join(plug, "more", "draw"), { recursive: true });
  await writeFile(join(plug, "more", "draw", "SKILL.md"), "---\nname: draw\n---\n");
  assert.deepEqual(pluginSkills(plug).map((x) => x.name), ["draw", "lint"]);
  await rm(dir, { recursive: true });
});

import { createServer } from "node:http";
import { ApiSession, apiModels } from "../packages/adapters/api";
/** a fake OpenAI-compatible API on localhost: key "test-key", streams back what it was asked */
async function fakeApi() {
  const seen: any[] = [];
  const server = createServer((req, res) => {
    if (req.headers.authorization !== "Bearer test-key") {
      res.writeHead(401, { "content-type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "Invalid API Key" } }));
    }
    if (req.url === "/v1/models") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ data: [{ id: "llama-fast" }, { id: "whisper-large" }, { id: "org/big-model" }] }));
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const b = JSON.parse(body);
      seen.push(b);
      // an older server that does not know stream_options
      if (b.model === "old-server" && b.stream_options) {
        res.writeHead(400, { "content-type": "application/json" });
        return res.end(JSON.stringify({ error: { message: "Unrecognized request argument supplied: stream_options" } }));
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      // xAI's Responses API: text deltas, then response.completed with usage and the search tools it ran
      if (req.url === "/v1/responses") {
        for (const piece of ["Latest on X ", "[[1]](https://x.com/a/status/1)"]) res.write(`data: ${JSON.stringify({ type: "response.output_text.delta", delta: piece })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: "response.completed", response: { usage: { input_tokens: 900, output_tokens: 40, server_side_tool_usage_details: { x_search_calls: 1, x_posts_fetched: 12, web_search_calls: 0 } } } })}\n\n`);
        return res.end("data: [DONE]\n\n");
      }
      const last = b.messages.at(-1).content;
      for (const piece of ["echo: ", String(typeof last === "string" ? last : last[0].text).slice(-20)])
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: piece } }] })}\n\n`);
      if (b.stream_options?.include_usage) res.write(`data: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 5, total_tokens: 17 } })}\n\n`);
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  // never keeps the test run alive, even when an assertion fails before close()
  server.unref();
  return { url: `http://127.0.0.1:${(server.address() as any).port}/v1`, seen, close: () => (server.closeAllConnections(), server.close()) };
}
test("API models: list, stream a reply, keep the conversation, refuse a wrong key", async () => {
  const api = await fakeApi();
  assert.deepEqual((await apiModels({ baseUrl: api.url, key: "test-key" })).map((m) => m.id), ["llama-fast", "org/big-model"]);
  await assert.rejects(apiModels({ baseUrl: api.url, key: "wrong" }), /401.*Invalid API Key/);
  const s = new ApiSession({ baseUrl: api.url, key: "test-key" }, "llama-fast", "be brief");
  assert.equal(s.fresh, true);
  let streamed = "";
  assert.equal(await s.run("hello there", (d) => (streamed += d), async () => true), "echo: hello there");
  assert.equal(streamed, "echo: hello there");
  await s.run("second", () => {}, async () => true);
  assert.deepEqual(api.seen[1].messages.map((m: any) => m.role), ["system", "user", "assistant", "user"]);
  assert.equal(s.fresh, false);
  // each call reports its tokens; a server that refuses stream_options still answers (no counts then)
  assert.deepEqual({ ...s.lastCall, ms: 0 }, { model: "llama-fast", input: 12, output: 5, ms: 0, ok: true });
  const old = new ApiSession({ baseUrl: api.url, key: "test-key" }, "old-server", "");
  assert.equal(await old.run("hi", () => {}, async () => true), "echo: hi");
  assert.equal(old.lastCall?.ok, true);
  assert.equal(old.lastCall?.input, undefined);
  // Grok: the Responses API with X and web search; citations become links; the searches are counted
  const grok = new ApiSession({ baseUrl: api.url, key: "test-key", xai: true }, "grok-4.3", "be brief");
  assert.equal(await grok.run("what is new", () => {}, async () => true), "Latest on X [1](https://x.com/a/status/1)");
  const sent = api.seen.at(-1);
  assert.deepEqual(sent.tools, [{ type: "web_search" }, { type: "x_search" }]);
  assert.deepEqual(sent.input.map((m: any) => m.role), ["system", "user"]);
  assert.deepEqual(grok.lastCall?.tools, { x_search_calls: 1, x_posts_fetched: 12 });
  assert.equal(grok.lastCall?.input, 900);
  // a wrong key is a failed call with the reason
  const bad = new ApiSession({ baseUrl: api.url, key: "wrong" }, "llama-fast", "");
  await assert.rejects(bad.run("x", () => {}, async () => true), /401/);
  assert.equal(bad.lastCall?.ok, false);
  assert.match(bad.lastCall?.error ?? "", /Invalid API Key/);
  api.close();
});
test("API providers in the host: key in memory only, models in the catalog, chat works, never the builder", async () => {
  const api = await fakeApi();
  const dir = await mkdtemp(join(tmpdir(), "walt-api-"));
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.saveProvider({ name: "Groq", baseUrl: api.url + "/" });
  assert.equal(p.id, "groq");
  assert.equal(p.baseUrl, api.url);
  assert.equal(host.state.engines.find((e) => e.engine === "api:groq")?.auth, "required", "no key yet");
  await host.setKeys({ groq: "test-key" });
  const report = host.state.engines.find((e) => e.engine === "api:groq");
  assert.equal(report?.auth, "ok");
  assert.equal(report?.keyed, true);
  assert.equal(host.state.catalog?.["api:groq"]?.find((m) => m.isDefault)?.id, "llama-fast");
  assert.ok(!JSON.stringify(host.state).includes("test-key"), "the key never enters the saved state");
  // a plain chat on the API's default model
  const r = host.newChat("");
  host.setTarget(r.id, { engine: "api:groq", model: "default" });
  await host.send(r.id, "what is 2+2");
  for (let i = 0; i < 50 && host.room(r.id).state === "running"; i++) await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(host.room(r.id).messages.at(-1)?.text, "echo: what is 2+2");
  // the call is in the log for Customize · AI & models
  assert.equal(host.state.apiCalls?.[0]?.provider, "groq");
  assert.equal(host.state.apiCalls?.[0]?.room, r.id);
  assert.equal(host.state.apiCalls?.[0]?.output, 5);
  host.clearCalls("groq");
  assert.equal(host.state.apiCalls?.length, 0);
  assert.equal(host.persona(host.room(r.id).builder).avatar, "api:groq");
  // it may review or talk, never build
  const g = host.persona(host.room(r.id).builder).id;
  assert.throws(() => host.saveTeam({ name: "T", talk: false, picks: [{ engine: "api:groq", model: "llama-fast", role: "Builder" }, { engine: "claude", model: "opus", role: "Reviewer" }] }), /cannot be the builder/);
  assert.throws(() => host.removeProvider("groq"), /still in/);
  await assert.rejects(host.saveProvider({ name: "x", baseUrl: "ftp://nope" }), /must start with https/);
  await assert.rejects(host.saveProvider({ name: "Bad", baseUrl: "not a url" }), /not a web address/);
  // removing it takes its models (personas) and the chat's pick with it
  host.deleteRoom(r.id);
  host.removeProvider("groq");
  assert.ok(!host.state.personas.some((x) => x.id === g));
  assert.equal(host.state.catalog?.["api:groq"], undefined);
  await host.close();
  api.close();
  await rm(dir, { recursive: true });
});

import { AcpSession, acpModels, askFor, choose } from "../packages/adapters/acp";
/** a stand-in for `agy acp`: lists two models, asks to edit a file, says what Walt answered */
const FAKE_AGY = `
const rl = require("readline").createInterface({ input: process.stdin });
const send = (m) => process.stdout.write(JSON.stringify({ jsonrpc: "2.0", ...m }) + "\\n");
let model = "auto";
let waiting;
rl.on("line", (line) => {
  const m = JSON.parse(line);
  if (m.id != null && !m.method && waiting) return waiting(m.result);
  if (m.method === "initialize") return send({ id: m.id, result: { protocolVersion: 1, agentCapabilities: { loadSession: true } } });
  if (m.method === "session/new") {
    if (process.env.FAKE_UNSIGNED) return send({ id: m.id, error: { code: -32000, message: "Authentication required." } });
    return send({ id: m.id, result: { sessionId: "s1", models: { currentModelId: "auto", availableModels: [{ modelId: "auto", name: "Auto" }, { modelId: "gemini-pro", name: "Gemini Pro" }] } } });
  }
  if (m.method === "session/set_model") return (model = m.params.modelId), send({ id: m.id, result: {} });
  if (m.method === "session/prompt") {
    const text = m.params.prompt[0].text;
    waiting = (r) => {
      waiting = undefined;
      const said = r.outcome.optionId || r.outcome.outcome;
      for (const piece of ["[" + model + "] ", text.includes("Answer briefly") ? "(briefed) " : "", "edit " + said + ": ", text.split("\\n").pop()]) send({ method: "session/update", params: { sessionId: "s1", update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: piece } } } });
      send({ method: "session/update", params: { sessionId: "s1", update: { sessionUpdate: "usage_update", used: 1200, size: 1000000 } } });
      send({ id: m.id, result: { stopReason: "end_turn" } });
    };
    send({ id: 900, method: "session/request_permission", params: { sessionId: "s1", options: [{ optionId: "yes", kind: "allow_once" }, { optionId: "no", kind: "reject_once" }], toolCall: { toolCallId: "t1", title: "Write a.txt", kind: text.includes("look around") ? "read" : "edit", content: [{ type: "diff", path: "a.txt", oldText: "old", newText: "new" }] } } });
    return;
  }
  if (m.id != null) send({ id: m.id, error: { code: -32601, message: "unknown method" } });
});
`;
test("Antigravity over ACP: models, picked model, streamed text, edits ask the owner, read-only refuses, sign-in message", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-agy-"));
  const js = join(dir, "fake-agy.cjs");
  await writeFile(js, FAKE_AGY);
  const cmd = { exe: process.execPath, args: [js] };
  const models = await acpModels(cmd, dir);
  assert.deepEqual(models.map((m) => [m.id, m.label, !!m.isDefault]), [["auto", "Auto", true], ["gemini-pro", "Gemini Pro", false]]);
  const asked: any[] = [];
  const s = new AcpSession(cmd, dir, "gemini-pro", false, undefined, undefined, "Answer briefly");
  let streamed = "";
  const out = await s.run("please fix it", (d) => (streamed += d), async (tool, input) => (asked.push({ tool, input }), true));
  assert.equal(out, "[gemini-pro] (briefed) edit yes: please fix it", "Instructions go with the first message");
  assert.equal(streamed, out);
  assert.deepEqual(s.context, { used: 1200, size: 1000000 }, "usage_update becomes the context meter");
  assert.equal(asked[0].tool, "Edit");
  assert.deepEqual(asked[0].input.changes, [{ path: "a.txt", kind: "update", diff: "-old\n+new" }]);
  assert.equal(await s.run("no thanks", () => {}, async () => false), "[gemini-pro] edit no: no thanks");
  // reading is allowed without a card (agy runs strict, so it asks for reads too)
  assert.equal(await s.run("look around", () => {}, async () => (asked.push("read"), false)), "[gemini-pro] edit yes: look around");
  assert.equal(asked.length, 1);
  await s.stop();
  // read-only (reviews, chats without a project): a change is refused even if the answer is yes; Walt still hears
  // about it (it refuses there without a card and says why in the chat)
  const ro = new AcpSession(cmd, dir, "", true);
  let told = false;
  assert.equal(await ro.run("look only", () => {}, async () => ((told = true), true)), "[auto] edit no: look only");
  assert.equal(told, true);
  await ro.stop();
  // not signed in: say what to do
  process.env.FAKE_UNSIGNED = "1";
  await assert.rejects(acpModels(cmd, dir), /not signed in.*run agy once/);
  delete process.env.FAKE_UNSIGNED;
  assert.equal(askFor({ kind: "execute", title: "npm test", rawInput: { command: "npm test" } }).tool, "Shell");
  // agy's write_file carries no diff, only the new file
  assert.deepEqual((askFor({ kind: "edit", title: "File a.txt", rawInput: { Path: "a.txt", Content: "hi\nthere" } }).input as any).changes, [{ path: "a.txt", kind: "add", diff: "+hi\n+there" }]);
  assert.deepEqual(choose([{ optionId: "a", kind: "allow_always" }], true), { outcome: { outcome: "selected", optionId: "a" } });
  assert.deepEqual(choose([], false), { outcome: { outcome: "cancelled" } });
  // Windows holds the folder until the killed fake process has gone
  await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
});

import { address } from "../apps/ui/browser";
test("Browser address bar: local ports, web addresses, searches", () => {
  assert.equal(address("localhost:5173"), "http://localhost:5173");
  assert.equal(address("5173"), "http://localhost:5173");
  assert.equal(address("127.0.0.1:8080/app"), "http://127.0.0.1:8080/app");
  assert.equal(address("https://example.com/x"), "https://example.com/x");
  assert.equal(address("antigravity.google"), "https://antigravity.google");
  assert.equal(address("berita mpr hari ini"), "https://www.google.com/search?q=berita%20mpr%20hari%20ini");
  assert.equal(address("berita mpr", "duckduckgo"), "https://duckduckgo.com/?q=berita%20mpr");
  // links in replies: web links can be opened (Settings · Browser says where), file paths and the rest stay text
  assert.match(md("see [the docs](https://example.com/a?b=1&c=2)"), /data-hot="link:https:\/\/example\.com\/a\?b=1&amp;c=2"/);
  assert.doesNotMatch(md("[note](/D:/x/walt-note.txt)"), /data-hot/);
  assert.doesNotMatch(md("[x](javascript:alert(1))"), /data-hot/);
  assert.equal(address("  "), "");
  // a page address is never anything but http(s): no file:, javascript: or walt-img:
  assert.ok(address("javascript:alert(1)").startsWith("https://www.google.com/search?q="));
  assert.ok(address("file:///C:/x").startsWith("https://"));
});

test("two builders at once: mention both, each builds its part in parallel; jobs change only when idle", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-two-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  const r = host.createRoom({ projectId: p.id, title: "T", template: "build_review", builder: "codex", reviewers: ["claude"] });
  // Builder adds a builder now; the last builder cannot leave
  host.member(r.id, "claude", "Builder");
  assert.deepEqual([r.builder, r.builders, r.reviewers], ["codex", ["claude"], []]);
  host.member(r.id, "sonnet", "Reviewer");
  let live = 0, most = 0;
  const prompts: Record<string, string> = {};
  const ro: Record<string, boolean> = {};
  (host.supervisor as any).get = async (_room: string, def: { id: string }, _root: string, readonly: boolean) => ({
    run: async (prompt: string) => {
      prompts[def.id] = prompt;
      ro[def.id] = readonly;
      most = Math.max(most, ++live);
      await new Promise((ok) => setTimeout(ok, 60));
      if (!readonly) await writeFile(join(root, def.id + ".txt"), "part of " + def.id);
      live--;
      return def.id + " did its part";
    },
    stop: async () => {},
  });
  await host.send(r.id, "@Codex build the API @Claude Opus build the page");
  for (let i = 0; i < 200 && r.state === "running"; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.equal(most, 2, "both builders ran at the same time");
  assert.deepEqual([ro.codex, ro.claude], [false, false], "both may edit");
  assert.match(prompts.codex, /working at the same time as Claude Opus/);
  assert.match(prompts.claude, /Do only the part meant for you \(@Claude Opus\)/);
  assert.equal(JSON.parse(prompts.claude).message, "@Codex build the API @Claude Opus build the page", "each sees the message with the @names");
  assert.equal(r.artifacts.length, 1, "one revision for both parts");
  assert.deepEqual(Object.keys(r.artifacts[0].files).sort(), ["claude.txt", "codex.txt"]);
  assert.deepEqual(r.messages.filter((m) => m.author !== "cello").map((m) => m.text).sort(), ["claude did its part", "codex did its part"]);
  assert.deepEqual(r.messages.find((m) => m.author === "cello")?.meta?.also, ["claude"]);
  // a builder and a reviewer mentioned together: the reviewer answers read-only
  await host.send(r.id, "@Codex add tests @Sonnet what do you think");
  for (let i = 0; i < 200 && r.state === "running"; i++) await new Promise((ok) => setTimeout(ok, 10));
  assert.deepEqual([ro.codex, ro.sonnet], [false, true]);
  // the first builder can leave while another builder stays; the last one cannot
  host.member(r.id, "codex", "Member");
  assert.deepEqual([r.builder, r.builders], ["claude", []]);
  assert.throws(() => host.member(r.id, "claude", "Member"), /Pick another builder/);
  await host.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
});

import { Supervisor } from "../packages/adapters/supervisor";
test("audit fixes: queued messages run, the process cap puts the idlest AI to sleep, approvals, old revisions", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-fix-"));
  const host = new Host(new Store(join(dir, "data")));
  // 1. a message sent while the AI works runs after it, once, as an ordinary message
  const r = host.newChat("");
  const asked: string[] = [];
  (host.supervisor as any).get = async () => ({ run: async (prompt: string) => (asked.push(prompt), await new Promise((ok) => setTimeout(ok, 50)), "re: " + prompt.split("\n").pop()), stop: async () => {} });
  await host.send(r.id, "first");
  await host.send(r.id, "second while busy");
  assert.equal(r.messages.at(-1)?.kind, "queued");
  for (let i = 0; i < 100 && (r.queue.length || (host as any).active.has(r.id)); i++) await new Promise((ok) => setTimeout(ok, 20));
  assert.equal(asked.length, 2, "the queued message ran");
  assert.ok(asked[1].endsWith("second while busy"));
  assert.ok(!r.messages.some((m) => m.kind === "queued"), "no waiting copy left");
  assert.deepEqual(r.messages.filter((m) => m.author === "cello").map((m) => m.text), ["first", "second while busy"]);
  // 4. with two cards open, answering one keeps the chat waiting for the other
  const answers = (host as any).answers as Map<string, (v: boolean) => void>;
  for (const id of ["a1", "a2"]) {
    host.state.asks.push({ id, roomId: r.id, kind: "tool_approval", title: "Edit", input: {}, persona: r.builder });
    answers.set(id, () => {});
  }
  host.answer("a1", true);
  assert.equal(r.state, "awaiting_user");
  host.answer("a2", false);
  assert.equal(r.state, "running");
  // 5. only the latest 5 revisions keep their file list; diff says when one is too old
  r.artifacts = Array.from({ length: 7 }, (_, i) => ({ revision: i + 1, hash: "h" + i, files: { "a.txt": "x" + i }, reviews: [], accepted: false }));
  (host as any).trim(r);
  assert.deepEqual(r.artifacts.map((a) => !!a.trimmed), [true, true, false, false, false, false, false]);
  assert.deepEqual(r.artifacts[0].files, {});
  // 2. six warm AIs and a seventh is needed: the one idle the longest sleeps; all six busy: a clear message
  const sup = new Supervisor();
  sup.setApi(new Map([["api:x", { baseUrl: "http://127.0.0.1:9/v1", key: "k" }]]));
  const stopped: string[] = [];
  const fake = (name: string, lastActive: number, busy = false) => ({ alive: true, busy, lastActive, stop: async () => void stopped.push(name) });
  for (let i = 0; i < 6; i++) (sup as any).sessions.set(`room:p${i}:false`, fake("p" + i, 1000 + i));
  const api = { id: "x1", name: "X", engine: "api:x", model: "m", strengths: [], avatar: "api:x" } as any;
  await sup.get("room", api, dir, true);
  assert.deepEqual(stopped, ["p0"], "the idlest went to sleep");
  for (const [k] of [...(sup as any).sessions]) (sup as any).sessions.delete(k);
  for (let i = 0; i < 6; i++) (sup as any).sessions.set(`room:b${i}:false`, fake("b" + i, 1000 + i, true));
  await assert.rejects(sup.get("room", { ...api, id: "x2" }, dir, true), /Six AIs are working at once/);
  await host.close();
  await rm(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 150 });
});
