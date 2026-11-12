import { build } from "esbuild";
import { join } from "node:path";
import { homedir } from "node:os";
await build({
  entryPoints: ["packages/adapters/claude.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/tests/claude.mjs",
});
const { ClaudeSession } = await import("../dist/tests/claude.mjs");
const session = new ClaudeSession(
  join(homedir(), ".local", "bin", "claude.exe"),
  process.cwd(),
  "sonnet",
  true,
);
try {
  await session.warm();
  console.log(
    "PASS: installed Claude completed stream-json initialization. No model prompt dispatched.",
  );
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await session.stop();
}
