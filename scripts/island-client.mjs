import fs from "node:fs/promises";
import path from "node:path";
const config = JSON.parse(
  await fs.readFile(
    path.join(process.env.APPDATA, "Walt", "control.json"),
    "utf8",
  ),
);
const headers = { Authorization: `Bearer ${config.token}` };
const base = `http://127.0.0.1:${config.port}/island/v1`;
console.log(await (await fetch(base + "/state", { headers })).json());
const stream = await fetch(base + "/feed", { headers });
for await (const chunk of stream.body) process.stdout.write(chunk);
