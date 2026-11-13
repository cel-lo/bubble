// Real Codex smoke (codex app-server, ChatGPT login): Walt's broker allow + deny, a warm second turn on the same
// process, a read-only reviewer that cannot write, and resume after a restart. Spends a few low-effort turns.
import { build } from "esbuild";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import assert from "node:assert/strict";
for (const [entry, out] of [["supervisor", "supervisor"], ["codex", "codex"]])
  await build({ entryPoints: [`packages/adapters/${entry}.ts`], bundle: true, platform: "node", format: "esm", outfile: `dist/tests/${out}.mjs` });
const { Supervisor } = await import("../dist/tests/supervisor.mjs");
const { CodexSession: Session } = await import("../dist/tests/codex.mjs");
const exe = new Supervisor().codexExe();
assert.ok(exe, "codex.exe not found");
const root = resolve("tests/fixtures/codex-smoke");
await fs.rm(root, { recursive: true, force: true });
await fs.mkdir(root, { recursive: true });
const asked = [];
const policy = (allow) => async (tool, input) => { asked.push(tool + ":" + JSON.stringify(input).slice(0, 80)); return allow; };
const timer = setTimeout(() => { console.error("codex smoke timed out"); process.exit(1); }, 300000);
let builder, reviewer, resumed;
try {
  builder = new Session(exe, root, "", false, "low");
  await builder.warm();
  const pid = builder.child.pid;
  await builder.run("Create a file named allowed.txt containing exactly WALT by editing files (no shell). Then reply DONE.", () => {}, policy(true));
  assert.ok(asked.some((a) => a.startsWith("Edit:")), "file edit did not go through the broker: " + asked.join(" | "));
  assert.equal((await fs.readFile(join(root, "allowed.txt"), "utf8")).trim(), "WALT");
  const before = asked.length;
  await builder.run("Create a file named denied.txt containing NO by editing files. If it is rejected, reply DENIED and stop.", () => {}, policy(false));
  assert.equal(builder.child.pid, pid, "second turn spawned a new process");
  assert.ok(asked.length > before, "second edit was not asked");
  assert.ok(!existsSync(join(root, "denied.txt")), "denied edit still created the file");
  const thread = builder.sessionId;
  await builder.stop();
  reviewer = new Session(exe, root, "", true, "low");
  const asked0 = asked.length;
  await reviewer.run("Read allowed.txt and reply with its content. Then try to create reviewer.txt.", () => {}, policy(true));
  assert.ok(!existsSync(join(root, "reviewer.txt")), "read-only reviewer wrote a file");
  assert.equal(asked.length, asked0, "a read-only reviewer must never reach the approval broker");
  resumed = new Session(exe, root, "", false, "medium", thread);
  const answer = await resumed.run("Which file did you create earlier in this conversation? Reply with only its name.", () => {}, policy(false));
  assert.match(answer, /allowed\.txt/);
  console.log(JSON.stringify({ pass: true, asked, samePid: true, resumed: thread, answer: answer.trim() }));
} catch (e) {
  console.error("FAIL", e.message, { asked });
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await builder?.stop();
  await reviewer?.stop();
  await resumed?.stop();
}
