import { createServer } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import type { Host } from "../host/service";
import { plain as line } from "../domain/command";
export async function controlServer(
  host: Host,
  dir: string,
  onOpen: (roomId?: string) => void,
) {
  const token = randomBytes(32).toString("base64url");
  const clients = new Set<import("node:http").ServerResponse>();
  let port = 0;
  const persona = (id: string) => host.state.personas.find((p) => p.id === id);
  // a plain chat's persona stands for whichever model it ran: name that model, as Walt's chat does
  const who = (r: { template: string; messages: { author: string; meta?: { model?: string } }[] }, id: string) => {
    const p = persona(id);
    const model = r.template === "direct" ? [...r.messages].reverse().find((m) => m.author === id)?.meta?.model : undefined;
    const label = p && model ? host.state.catalog?.[p.engine]?.find((m) => m.id === model)?.label : undefined;
    return label && label !== "Default" ? label : (p?.name ?? id);
  };
  const snapshot = () => {
    const working = new Set(host.supervisor.list().filter((p) => p.busy).map((p) => p.room + ":" + p.persona));
    // active = something is happening or waiting on you; idle chats and finished ones stay in Walt
    const rooms = host.state.rooms.filter(
      (r) => r.state === "running" || r.state === "awaiting_user" || r.state === "paused" || r.state === "recovery_required" || !!host.decisionOf(r),
    );
    const decisions = rooms.flatMap((r) => {
      const d = host.decisionOf(r);
      // answering from the island turned off: the question still shows, with no options (it opens Walt)
      const options = host.state.settings.islandAnswers === false ? [] : (d?.options ?? []).map((o) => line(o));
      return d ? [{ askId: "decision:" + r.id, kind: "decision", roomId: r.id, engine: persona(d.asker)?.engine, who: who(r, d.asker), title: line(d.question, 80), options, blocking: true }] : [];
    });
    return {
      revision: host.state.revision,
      walt: { status: "running", locale: host.state.settings.locale },
      engines: host.state.engines.map((e) => ({ engine: e.engine, auth: e.auth, quota: e.quota })),
      activeRooms: rooms.map((r) => {
        const team = [r.builder, ...(r.template === "direct" ? [] : r.reviewers)];
        // who is working now: a busy process, else the builder
        const owner = team.find((p) => working.has(r.id + ":" + p)) ?? r.builder;
        const last = [...r.messages].reverse().find((m) => m.author !== "cello" && m.text.trim());
        return {
          roomId: r.id,
          project: host.state.projects.find((p) => p.id === r.projectId)?.name ?? "",
          title: r.title,
          state: r.state,
          template: r.template,
          step: r.step,
          engines: team.map((p) => persona(p)?.engine ?? "claude"),
          owner: { persona: who(r, owner), engine: persona(owner)?.engine ?? "claude", process: working.has(r.id + ":" + owner) ? "busy" : "idle" },
          turn: { used: r.used, max: r.budget },
          // pause after this turn was asked: the chat still runs until its turn ends
          pause: r.pause,
          waiting: host.state.asks.filter((a) => a.roomId === r.id).length + (host.decisionOf(r) ? 1 : 0),
          lastLine: last ? line(last.text, 60) : "",
        };
      }),
      needsYou: [
        ...host.state.asks.map((a) => ({
          askId: a.id,
          roomId: a.roomId,
          kind: a.kind,
          engine: persona(a.persona)?.engine,
          who: persona(a.persona)?.name ?? a.persona,
          title: a.title,
          detail: line(typeof (a.input as any)?.command === "string" ? (a.input as any).command : typeof (a.input as any)?.file_path === "string" ? (a.input as any).file_path : "", 80),
          options: [],
          blocking: true,
        })),
        ...decisions,
      ],
    };
  };
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
      // shortcut: expectedRevision is required but not compared: streaming text bumps the revision several times a
      // second, so it would refuse nearly every click; each action checks its own target instead (room exists, decision still open)
      const room = path.match(/^\/island\/v1\/rooms\/([^/]+)\/(pause|resume|interrupt)$/);
      const ask = path.match(/^\/island\/v1\/asks\/([^/]+)\/answer$/);
      if (room) host.control(room[1], room[2]);
      else if (ask) {
        // only decisions are answered here; tool approvals always open Walt, so the full command is read there
        const id = decodeURIComponent(ask[1]);
        if (!id.startsWith("decision:") || typeof body.option !== "string" || host.state.settings.islandAnswers === false) {
          respond(403, { error: "not_allowed_from_island" });
          return;
        }
        await host.decide(id.slice(9), body.option, "island");
      } else if (path === "/island/v1/open") onOpen(typeof body.roomId === "string" ? body.roomId : undefined);
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
    /** islands following the feed right now */
    clients: () => clients.size,
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
