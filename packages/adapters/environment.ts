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
    const p = spawn(exe, args, {
      env: cleanEnv(),
      shell: false,
      windowsHide: true,
    });
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
        ? resolve(out.trim())
        : reject(new Error(err.trim() || out.trim() || "CLI failed"));
    });
  });
}
