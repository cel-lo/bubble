import { build } from "esbuild";
import { spawnSync } from "node:child_process";
await build({
  entryPoints: ["tests/core.test.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: "dist/tests/core.test.mjs",
});
const result = spawnSync(
  process.execPath,
  ["--test", "dist/tests/core.test.mjs"],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
