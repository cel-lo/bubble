import { build } from "esbuild";
import fs from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
await build({
  entryPoints: ["packages/adapters/claude.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/tests/claude.mjs",
});
const { ClaudeSession } = await import("../dist/tests/claude.mjs");
const root = resolve("tests/fixtures/provider-smoke");
await fs.mkdir(root, { recursive: true });
const session = new ClaudeSession(
  join(homedir(), ".local", "bin", "claude.exe"),
  root,
  "sonnet",
  true,
);
const timer = setTimeout(() => {
  console.error("Provider smoke timed out after 45 seconds.");
  process.exitCode = 1;
  void session.stop();
}, 45000);
try {
  await session.warm();
  let deltas = 0;
  const answer = await session.run(
    "Reply with exactly WALT_OK. Do not use any tools.",
    () => deltas++,
    async () => false,
  );
  console.log(JSON.stringify({ answer, deltas, processAlive: session.alive }));
  if (answer.trim() !== "WALT_OK") process.exitCode = 1;
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  await session.stop();
}
