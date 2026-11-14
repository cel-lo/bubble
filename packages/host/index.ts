import { z } from "zod";
import { Host } from "./service";
import { Store } from "../storage/store";
import { controlServer } from "../control-api/server";
import { MODEL_ID } from "../domain/command";
const parent = (process as any).parentPort;
const dir = process.argv[2];
const host = new Host(new Store(dir));
const persona = z.string().min(1).max(80);
const effort = z.enum(["low", "medium", "high", "xhigh", "max", "ultra"]);
const api = await controlServer(host, dir, (roomId) =>
  parent.postMessage({ type: "open", roomId }),
);
const view = () => ({ ...host.state, procs: host.supervisor.list() });
host.on("state", () => parent.postMessage({ type: "state", state: view() }));
host.on("delta", (delta) => parent.postMessage({ type: "delta", delta }));
const timer = setInterval(
  async () => {
    const before = host.supervisor.list().length;
    await host.supervisor.sleep(host.state.settings.idleMinutes);
    if (host.supervisor.list().length !== before) parent.postMessage({ type: "state", state: view() });
  },
  60000,
);
parent.on("message", async ({ data }: any) => {
  const { id, method, input } = data;
  try {
    let result: unknown;
    switch (method) {
      case "snapshot":
        result = view();
        break;
      case "doctor":
        result = await host.doctor();
        break;
      case "project":
        result = await host.project(
          z
            .object({
              name: z.string().min(1).max(100),
              root: z.string().min(1),
              goal: z.string().max(10000),
              constraints: z.string().max(10000),
            })
            .parse(input),
        );
        break;
      case "room":
        result = host.createRoom(
          z
            .object({
              projectId: z.string().max(80), // "" = a chat without a project
              title: z.string().min(1).max(100),
              template: z.enum([
                "direct",
                "build_review",
                "triad",
                "roundtable",
              ]),
              builder: persona,
              reviewers: z.array(persona).max(3),
            })
            .parse(input),
        );
        break;
      case "send": {
        const v = z
          .object({ roomId: z.string(), text: z.string().min(1).max(50000) })
          .parse(input);
        result = await host.send(v.roomId, v.text);
        break;
      }
      case "control": {
        const v = z
          .object({
            roomId: z.string(),
            action: z.enum(["pause", "interrupt", "resume", "continue", "end", "recovered"]),
          })
          .parse(input);
        result = host.control(v.roomId, v.action);
        break;
      }
      case "approval": {
        const v = z.object({ id: z.string(), allow: z.boolean() }).parse(input);
        result = host.answer(v.id, v.allow);
        break;
      }
      case "backup":
        result = host.backup();
        break;
      case "island":
        result = { connected: api.clients() > 0 };
        break;
      case "limit.handoff": {
        const v = z.object({ roomId: z.string(), to: z.string().min(1).max(120) }).parse(input);
        result = await host.handOff(v.roomId, v.to);
        break;
      }
      case "backups":
        result = { dir: host.store.dir, list: host.backups() };
        break;
      case "diff":
        // a chat id, or { roomId, revision } for an older revision
        result = typeof input === "string" ? await host.diff(z.string().parse(input)) : await host.diff(...((v) => [v.roomId, v.revision] as const)(z.object({ roomId: z.string(), revision: z.number().int().positive() }).parse(input)));
        break;
      case "accept":
        result = await host.accept(z.string().parse(input));
        break;
      case "settings":
        // merge, so fields the form does not send (last model, onboarding) survive
        host.state.settings = {
          ...host.state.settings,
          ...z
            .object({
              locale: z.enum(["en", "id"]),
              theme: z.enum(["dark", "light"]),
              idleMinutes: z.number().int().min(5).max(60),
              onboarded: z.boolean(),
              claudeShell: z.boolean(),
              islandAnswers: z.boolean(),
              closeAction: z.enum(["tray", "quit"]),
              instructions: z.string().max(4000),
              notify: z.boolean(),
              // default model for new chats (also set by picking a model in a chat)
              lastTarget: z.object({ engine: z.enum(["claude", "codex"]), model: z.string().regex(MODEL_ID), effort: effort.optional() }),
            })
            .partial()
            .parse(input),
        };
        host.commit();
        break;
      case "chat.new":
        result = host.newChat(z.string().max(80).parse(input ?? ""));
        break;
      case "chat.target": {
        const v = z
          .object({ roomId: z.string(), engine: z.enum(["claude", "codex"]), model: z.string().regex(MODEL_ID), effort: effort.optional() })
          .parse(input);
        result = host.setTarget(v.roomId, v);
        break;
      }
      case "chat.rename": {
        const v = z.object({ roomId: z.string(), title: z.string().max(200) }).parse(input);
        result = host.rename(v.roomId, v.title);
        break;
      }
      case "chat.delete":
        result = host.deleteRoom(z.string().parse(input));
        break;
      case "persona.save":
        result = host.savePersona(
          z
            .object({
              id: z.string().max(80).optional(),
              name: z.string().min(1).max(40),
              engine: z.enum(["codex", "claude", "gemini"]),
              // model ids go straight to the CLI as one argv entry; keep them to plain id characters
              model: z.string().regex(MODEL_ID, "Model id may only use letters, digits and . : / - _ (max 80)").or(z.literal("")),
              effort: effort.optional(),
              strengths: z.array(z.string().min(1).max(30)).max(6),
              avatar: z.enum(["codex", "claude", "sonnet", "gemini"]),
            })
            .parse(input),
        );
        break;
      case "image.save": {
        // base64 of at most ~15 MB of picture
        const v = z.object({ data: z.string().max(20_000_000).regex(/^[A-Za-z0-9+/=]+$/), ext: z.enum(["png", "jpg", "jpeg", "webp", "gif"]) }).parse(input);
        result = host.saveAttachment(v.data, v.ext);
        break;
      }
      case "tools.list":
        result = host.tools();
        break;
      case "skills.list":
        result = host.skills();
        break;
      case "tools.set": {
        const v = z.object({ key: z.string().regex(/^[\w:@.-]{1,160}$/), on: z.boolean() }).parse(input);
        result = host.setTool(v.key, v.on);
        break;
      }
      case "team.save":
        result = host.saveTeam(
          z
            .object({
              name: z.string().min(1).max(60),
              talk: z.boolean(),
              picks: z.array(z.object({ engine: z.enum(["claude", "codex"]), model: z.string().regex(MODEL_ID).or(z.literal("")), role: z.enum(["Builder", "Reviewer", "Member"]), effort: effort.optional() })).min(2).max(8),
            })
            .parse(input),
        );
        break;
      case "team.delete":
        result = host.deleteTeam(z.string().parse(input));
        break;
      case "persona.delete":
        result = host.deletePersona(z.string().parse(input));
        break;
      case "cli.continue": {
        const v = z.object({ roomId: z.string(), persona: persona.optional() }).parse(input);
        result = host.continueInCli(v.roomId, v.persona);
        break;
      }
      case "context.export":
        result = host.exportContext(z.string().parse(input));
        break;
      case "persona.for": {
        // a model picked from a list (Add model, new project): reuse or make its persona
        const v = z.object({ engine: z.enum(["claude", "codex"]), model: z.string().regex(MODEL_ID).or(z.literal("")), effort: effort.optional() }).parse(input);
        result = host.personaFor(v);
        break;
      }
      case "room.auto": {
        const v = z.object({ roomId: z.string(), on: z.boolean() }).parse(input);
        result = host.setAuto(v.roomId, v.on);
        break;
      }
      case "member": {
        const v = z.object({ roomId: z.string(), persona, role: z.enum(["Builder", "Reviewer", "Member", "Remove"]) }).parse(input);
        result = host.member(v.roomId, v.persona, v.role);
        break;
      }
      case "quit":
        clearInterval(timer);
        await api.close();
        await host.close();
        process.exit(0);
        break;
      default:
        throw new Error("Unsupported action");
    }
    parent.postMessage({ id, result });
  } catch (error) {
    parent.postMessage({ id, error: String(error) });
  }
});
parent.postMessage({ type: "ready" });
