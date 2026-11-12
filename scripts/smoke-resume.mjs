// Real Claude smoke: --effort is accepted, and a restarted process with --resume continues the conversation
// (what Walt does when /effort or /model changes, or after a persona slept). Spends two tiny turns.
import { build } from "esbuild";
import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import assert from "node:assert/strict";
await build({ entryPoints: ["packages/adapters/claude.ts"], bundle: true, platform: "node", format: "esm", outfile: "dist/tests/claude.mjs" });
const { ClaudeSession } = await import("../dist/tests/claude.mjs");
const exe = join(homedir(), ".local", "bin", "claude.exe");
const root = resolve("tests/fixtures/provider-smoke");
await fs.mkdir(root, { recursive: true });
const no = async () => false;
const timer = setTimeout(() => { console.error("resume smoke timed out"); process.exit(1); }, 180000);
let a, b;
try {
  a = new ClaudeSession(exe, root, "sonnet", true, "low");
  await a.run("Remember this codeword: PINEAPPLE-42. Reply with only OK.", () => {}, no);
  const id = a.sessionId;
  assert.ok(id, "no session id captured");
  await a.stop();
  b = new ClaudeSession(exe, root, "sonnet", true, "high", id);
  const answer = await b.run("What was the codeword? Reply with only the codeword.", () => {}, no);
  assert.match(answer, /PINEAPPLE-42/);
  console.log(JSON.stringify({ pass: true, effortLow: "accepted", effortHigh: "accepted", resumedFrom: id, answer: answer.trim() }));
} catch (e) {
  console.error("FAIL", e.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await a?.stop();
  await b?.stop();
}
