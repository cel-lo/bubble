import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { overlaps, takeTurn } from "../packages/domain/model";
import { cleanEnv } from "../packages/adapters/environment";
import { manifest } from "../packages/host/files";
import { Store } from "../packages/storage/store";
import { Host } from "../packages/host/service";
import { controlServer } from "../packages/control-api/server";
test("lease roots compare case, separators, parent and sibling correctly", () => {
  assert.equal(overlaps("D:\\Work", "d:/work/sub"), true);
  assert.equal(overlaps("D:/Work", "D:/Workshop"), false);
  assert.equal(overlaps("D:/WORK/", "d:/work"), true);
});
test("turn budget cannot be exceeded", () => {
  const room = { used: 3, budget: 4 } as any;
  takeTurn(room);
  assert.throws(() => takeTurn(room), /exhausted/);
  assert.equal(room.used, 4);
});
test("CLI environment strips credentials and nesting flags", () => {
  const clean = cleanEnv({
    PATH: "safe",
    ANTHROPIC_API_KEY: "secret",
    OPENAI_API_KEY: "secret",
    GEMINI_API_KEY: "secret",
    ANTHROPIC_AUTH_TOKEN: "secret",
    CLAUDECODE: "1",
  });
  assert.deepEqual(clean, { PATH: "safe" });
});
test("manifest changes with file revision and handles Unicode path", async () => {
  const root = await mkdtemp(join(tmpdir(), "walt-é "));
  try {
    await writeFile(join(root, "測試.txt"), "one");
    const a = await manifest(root);
    await writeFile(join(root, "測試.txt"), "two");
    const b = await manifest(root);
    assert.notEqual(a.hash, b.hash);
    assert.equal(Object.keys(b.files).length, 1);
  } finally {
    await rm(root, { recursive: true });
  }
});
test("SQLite restart preserves messages and flags unfinished runs without replay", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-test-"));
  let store = new Store(dir);
  const state = store.load();
  state.rooms.push({
    id: "r",
    projectId: "p",
    title: "Main",
    template: "direct",
    builder: "sonnet",
    reviewers: [],
    state: "running",
    messages: [],
    used: 1,
    budget: 1,
    step: "build",
    pause: false,
    artifacts: [],
    queue: [],
  });
  store.save(state);
  store.close();
  store = new Store(dir);
  const host = new Host(store);
  assert.equal(host.state.rooms[0].state, "recovery_required");
  assert.equal(host.supervisor.sessions.size, 0);
  await host.close();
  await rm(dir, { recursive: true });
});
test("island rejects browser origins, bad auth and approvals; supports revisions and dedupe", async () => {
  const dir = await mkdtemp(join(tmpdir(), "walt-api-"));
  const host = new Host(new Store(dir));
  const r = host.createRoom.bind(host);
  host.state.projects.push({
    id: "p",
    root: dir,
    name: "Fixture",
    goal: "",
    constraints: "",
  });
  const room = r({
    projectId: "p",
    title: "Main",
    template: "direct",
    builder: "sonnet",
    reviewers: [],
  });
  const api = await controlServer(host, dir, () => {});
  try {
    const { readFile } = await import("node:fs/promises");
    const cfg = JSON.parse(await readFile(join(dir, "control.json"), "utf8"));
    const base = `http://127.0.0.1:${api.port}`;
    const fetch = async (url: string, options: any = {}) => {
      const { Readable } = await import("node:stream");
      const req = Readable.from(options.body ? [options.body] : []);
      Object.assign(req, {
        url: new URL(url).pathname,
        method: options.method || "GET",
        headers: Object.fromEntries(
          Object.entries({
            host: `127.0.0.1:${api.port}`,
            ...options.headers,
          }).map(([k, v]) => [k.toLowerCase(), v]),
        ),
      });
      return await new Promise<{ status: number }>((resolve) => {
        let status = 200;
        const res = {
          writeHead: (code: number) => {
            status = code;
          },
          end: () => resolve({ status }),
        };
        api.server.emit("request", req as any, res as any);
      });
    };
    const headers = {
      Authorization: "Bearer " + cfg.token,
      "Content-Type": "application/json",
    };
    assert.equal((await fetch(base + "/island/v1/state")).status, 401);
    assert.equal(
      (
        await fetch(base + "/island/v1/state", {
          headers: { ...headers, Origin: "http://evil.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/island/v1/asks/a/answer", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      403,
    );
    const body = JSON.stringify({
      commandId: "pause-1",
      expectedRevision: host.state.revision,
    });
    const endpoint = base + "/island/v1/rooms/" + room.id + "/pause";
    assert.equal(
      (await fetch(endpoint, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(room.state, "paused");
    assert.equal(
      (await fetch(endpoint, { method: "POST", headers, body })).status,
      200,
    );
    assert.equal(
      (
        await fetch(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({ commandId: "pause-2", expectedRevision: 0 }),
        })
      ).status,
      409,
    );
  } finally {
    await api.close();
    await host.close();
    await rm(dir, { recursive: true });
  }
});
