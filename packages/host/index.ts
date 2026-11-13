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
const api = await controlServer(host, dir, () =>
  parent.postMessage({ type: "open" }),
);
const view = () => ({ ...host.state, procs: host.supervisor.list() });
host.on("state", () => parent.postMessage({ type: "state", state: view() }));
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
              projectId: z.string(),
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
            action: z.enum(["pause", "interrupt", "resume", "continue", "end"]),
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
      case "accept":
        result = await host.accept(z.string().parse(input));
        break;
      case "settings":
        host.state.settings = z
          .object({
            locale: z.enum(["en", "id"]),
            theme: z.enum(["dark", "light"]),
            idleMinutes: z.number().int().min(5).max(60),
          })
          .parse(input);
        host.commit();
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
      case "persona.delete":
        result = host.deletePersona(z.string().parse(input));
        break;
      case "member": {
        const v = z.object({ roomId: z.string(), persona, role: z.enum(["Reviewer", "Member", "Remove"]) }).parse(input);
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
