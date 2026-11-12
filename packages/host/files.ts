import { readdir, readFile, lstat, realpath } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
export const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
export async function canonicalRoot(root: string) {
  const p = await realpath(root);
  if (!(await lstat(p)).isDirectory())
    throw new Error("Select a project folder");
  return p;
}
export async function manifest(root: string) {
  const files: Record<string, string> = {};
  let count = 0;
  const walk = async (dir: string, prefix = "") => {
    for (const item of (await readdir(dir, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    )) {
      if (["node_modules", ".git"].includes(item.name) || item.isSymbolicLink())
        continue;
      const rel = prefix + item.name;
      if (item.isDirectory()) await walk(join(dir, item.name), rel + "/");
      else if (item.isFile()) {
        if (++count > 20000)
          throw new Error(
            "Project exceeds 20,000 files. Select a smaller root.",
          );
        const stat = await lstat(join(dir, item.name));
        if (stat.size > 20 * 1024 * 1024)
          throw new Error("File exceeds snapshot limit: " + rel);
        files[rel] = hash(await readFile(join(dir, item.name)));
      }
    }
  };
  await walk(root);
  return { files, hash: hash(JSON.stringify(files)) };
}
