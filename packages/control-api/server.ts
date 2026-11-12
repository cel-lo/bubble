import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Host } from "../host/service";
export async function controlServer(
  host: Host,
  dir: string,
  onOpen: () => void,
) {
  const token = randomBytes(32).toString("base64url");
  const clients = new Set<import("node:http").ServerResponse>();
  let port = 0;
  const snapshot = () => ({
    revision: host.state.revision,
    walt: { status: "running", locale: host.state.settings.locale },
    engines: host.state.engines,
    activeRooms: host.state.rooms
      .filter((r) => r.state !== "ended")
      .map((r) => ({
        roomId: r.id,
        project: host.state.projects.find((p) => p.id === r.projectId)?.name,
        title: r.title,
        state: r.state,
        template: r.template,
        step: r.step,
        turn: { used: r.used, max: r.budget },
        lastLine: r.messages.at(-1)?.text.slice(0, 60) || "",
      })),
    needsYou: host.state.asks.map((a) => ({
      askId: a.id,
      roomId: a.roomId,
      kind: a.kind,
      title: a.title,
      options: [],
    })),
  });
  const server = createServer(async (req, res) => {
    const respond = (code: number, value: unknown) => {
      res.writeHead(code, { "Content-Type": "application/json" });
      res.end(JSON.stringify(value));
    };
    try {
      if (req.headers.origin || req.headers.host !== `127.0.0.1:${port}`) {
        respond(403, { error: "invalid_origin_or_host" });
        return;
      }
      const auth = Buffer.from(req.headers.authorization || "");
      const expected = Buffer.from("Bearer " + token);
      if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) {
        respond(401, { error: "unauthorized" });
        return;
      }
      const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
      const path = url.pathname;
      if (req.method === "GET" && path === "/island/v1/hello") {
        respond(200, {
          contract: "walt-control/1",
          app: "Walt",
          locale: host.state.settings.locale,
        });
        return;
      }
      if (req.method === "GET" && path === "/island/v1/state") {
        respond(200, snapshot());
        return;
      }
      if (req.method === "GET" && path === "/island/v1/feed") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        res.write("event: resync\ndata: {}\n\n");
        clients.add(res);
        req.on("close", () => clients.delete(res));
        return;
      }
      if (req.method !== "POST") {
        respond(404, { error: "not_found" });
        return;
      }
      let raw = "";
      for await (const chunk of req) {
        raw += chunk;
        if (raw.length > 16000) {
          respond(413, { error: "too_large" });
          return;
        }
      }
      const body = JSON.parse(raw || "{}");
      if (/\/asks\//.test(path)) {
        respond(403, { error: "not_allowed_from_island" });
        return;
      }
      if (
        typeof body.commandId !== "string" ||
        body.commandId.length > 128 ||
        !Number.isInteger(body.expectedRevision)
      ) {
        respond(400, { error: "commandId_and_expectedRevision_required" });
        return;
      }
      const fingerprint = JSON.stringify({ path, body });
      const previous = host.store.db
        .prepare("SELECT fingerprint,result FROM commands WHERE id=?")
        .get(body.commandId) as
        | { fingerprint: string; result: string }
        | undefined;
      if (previous) {
        respond(
          previous.fingerprint === fingerprint ? 200 : 409,
          previous.fingerprint === fingerprint
            ? JSON.parse(previous.result)
            : { error: "command_id_conflict" },
        );
        return;
      }
      if (body.expectedRevision !== host.state.revision) {
        respond(409, { error: "revision_conflict" });
        return;
      }
      const room = path.match(/^\/island\/v1\/rooms\/([^/]+)\/(pause|resume)$/);
      if (room) host.control(room[1], room[2]);
      else if (path === "/island/v1/open") onOpen();
      else {
        respond(403, { error: "not_allowed_from_island" });
        return;
      }
      const result = { ok: true, revision: host.state.revision };
      host.store.db
        .prepare("INSERT INTO commands VALUES(?,?,?)")
        .run(body.commandId, fingerprint, JSON.stringify(result));
      respond(200, result);
    } catch (e) {
      respond(400, { error: String(e) });
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as import("node:net").AddressInfo).port;
  await writeFile(
    join(dir, "control.json"),
    JSON.stringify({
      contract: "walt-control/1",
      port,
      token,
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
    { mode: 0o600 },
  );
  const publish = () => {
    const data = `id: ${host.state.revision}\nevent: room.updated\ndata: ${JSON.stringify(snapshot())}\n\n`;
    for (const client of clients) client.write(data);
  };
  let queued: ReturnType<typeof setTimeout> | undefined;
  const update = () => {
    if (!queued)
      queued = setTimeout(() => {
        queued = undefined;
        publish();
      }, 250);
  };
  host.on("state", update);
  const heartbeat = setInterval(() => {
    for (const c of clients) c.write("event: heartbeat\ndata: {}\n\n");
  }, 15000);
  return {
    port,
    server,
    close: async () => {
      clearInterval(heartbeat);
      clearTimeout(queued);
      host.off("state", update);
      for (const c of clients) c.end();
      server.close();
      await unlink(join(dir, "control.json")).catch(() => {});
    },
  };
}
