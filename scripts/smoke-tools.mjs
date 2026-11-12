// Real Claude smoke: Walt's permission broker (allow + deny), a warm second turn on the same process,
// and a read-only reviewer that cannot write. Uses the CLI's own login; spends a few small turns.
import { build } from "esbuild";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";
await build({ entryPoints: ["packages/adapters/claude.ts"], bundle: true, platform: "node", format: "esm", outfile: "dist/tests/claude.mjs" });
const { ClaudeSession } = await import("../dist/tests/claude.mjs");
const exe = join(homedir(), ".local", "bin", "claude.exe");
const root = resolve("tests/fixtures/tools-smoke");
await fs.rm(root, { recursive: true, force: true });
await fs.mkdir(root, { recursive: true });
const asked = [];
const policy = (allow) => async (tool, input) => { asked.push(tool); return allow; };
const builder = new ClaudeSession(exe, root, "sonnet", false);
const reviewer = new ClaudeSession(exe, root, "sonnet", true);
const timer = setTimeout(() => { console.error("tools smoke timed out"); process.exit(1); }, 240000);
try {
  await builder.warm();
  const pid = builder.child.pid;
  // 1. allow: the Write goes through Walt's broker and lands on disk
  await builder.run("Create a file named allowed.txt containing exactly WALT. Use the Write tool. Then reply DONE.", () => {}, policy(true));
  assert.ok(asked.includes("Write"), "Write was not routed through the approval broker");
  assert.equal((await fs.readFile(join(root, "allowed.txt"), "utf8")).trim(), "WALT");
  // 2. deny on the same warm process: no file appears
  const t0 = Date.now();
  await builder.run("Create a file named denied.txt containing NO with the Write tool. If it is denied, reply DENIED.", () => {}, policy(false));
  const warmMs = Date.now() - t0;
  assert.equal(builder.child.pid, pid, "second turn spawned a new process");
  assert.ok(!existsSync(join(root, "denied.txt")), "denied write still created the file");
  // 3. read-only reviewer: write tools are not even offered, so nothing is created and nothing is asked
  const before = asked.length;
  await reviewer.run("Read allowed.txt and reply with its content. Then try to create reviewer.txt.", () => {}, policy(true));
  assert.ok(!existsSync(join(root, "reviewer.txt")), "read-only reviewer wrote a file");
  console.log(JSON.stringify({ pass: true, approvalsAsked: asked, reviewerAsked: asked.length - before, samePid: true, warmTurnMs: warmMs }));
} catch (e) {
  console.error("FAIL", e.message, { asked });
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await builder.stop();
  await reviewer.stop();
}
