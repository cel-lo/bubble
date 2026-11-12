import { spawn } from "node:child_process";
export function cleanEnv(source = process.env) {
  const env = { ...source };
  for (const key of Object.keys(env)) {
    if (
      /API_?KEY|AUTH_TOKEN|ACCESS_TOKEN|SECRET_ACCESS_KEY|CLAUDECODE|CLAUDE_CODE_ENTRYPOINT|ELECTRON_RUN_AS_NODE/i.test(
        key,
      )
    )
      delete env[key];
  }
  return env;
}
export function capture(
  exe: string,
  args: string[],
  timeout = 12000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Node refuses to spawn .cmd shims without a shell. Probes only pass fixed words (--version, login status),
    // never user text. shortcut: real Codex/Gemini runs must start the shim's native/JS entry instead of cmd.exe.
    const shim = /\.cmd$/i.test(exe);
    if (shim && args.some((a) => !/^[\w-]+$/.test(a))) throw new Error("Probe arguments must be plain words");
    const p = shim
      ? spawn(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `"${exe}" ${args.join(" ")}`], { env: cleanEnv(), windowsHide: true, windowsVerbatimArguments: true })
      : spawn(exe, args, { env: cleanEnv(), shell: false, windowsHide: true });
    let out = "";
    let err = "";
    const t = setTimeout(() => {
      p.kill();
      reject(new Error("CLI probe timed out"));
    }, timeout);
    p.stdout.on("data", (b) => (out += b));
    p.stderr.on("data", (b) => (err += b));
    p.on("error", (e) => {
      clearTimeout(t);
      reject(e);
    });
    p.on("close", (code) => {
      clearTimeout(t);
      code === 0
        ? resolve(out.trim() || err.trim()) // codex prints `login status` on stderr
        : reject(new Error(err.trim() || out.trim() || "CLI failed"));
    });
  });
}
