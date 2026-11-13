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
  assert.equal(writes() - before, 2, "unchanged message not rewritten (only the state row and the event)");
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
  await host.close();
  await rm(dir, { recursive: true });
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
  assert.throws(() => host.saveTeam({ name: "x", talk: false, picks: [{ ...picks[0], role: "Reviewer" }, picks[1]] }), /exactly one builder/);
  const b = host.saveTeam({ name: "web TEAM", talk: true, picks });
  assert.equal(b.id, a.id, "same name replaces the template");
  assert.equal(host.state.teams!.length, 1);
  host.deleteTeam(a.id);
  assert.equal(host.state.teams!.length, 0);
  await host.close();
  await rm(dir, { recursive: true });
});

test("MCP servers are off until a project turns one on", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-mcp-"));
  const root = join(dir, "proj");
  await mkdir(root);
  const host = new Host(new Store(join(dir, "data")));
  host.supervisor.claudeMcp = () => ({ demo: { type: "stdio", command: "demo.exe", env: { TOKEN: "secret" } }, other: { type: "stdio", command: "x" } });
  const p = await host.project({ name: "P", root, goal: "", constraints: "" });
  assert.ok(host.mcpServers().some((s) => s.name === "demo" && s.engines.includes("claude") && !s.projects.length));
  assert.throws(() => host.setMcp(p.id, "nope", true), /No MCP server/);
  host.setMcp(p.id, "demo", true);
  assert.deepEqual(host.mcpServers().find((s) => s.name === "demo")!.projects, [p.id]);
  const file = (host.supervisor as any).claudeMcpFile(["demo"]);
  const cfg = JSON.parse((await import("node:fs")).readFileSync(file, "utf8"));
  assert.deepEqual(Object.keys(cfg.mcpServers), ["demo"], "Claude gets only the servers this project turned on");
  assert.equal((host.supervisor as any).claudeMcpFile([]), undefined, "none on: Claude keeps its empty MCP config");
  host.setMcp(p.id, "demo", false);
  assert.deepEqual(host.state.projects.find((x) => x.id === p.id)!.mcp, []);
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
    const args: string[] = (s as any).child.spawnargs;
    void s.stop();
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
