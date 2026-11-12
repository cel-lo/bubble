import { z } from "zod";
import { Host } from "./service";
import { Store } from "../storage/store";
import { controlServer } from "../control-api/server";
const parent = (process as any).parentPort;
const dir = process.argv[2];
const host = new Host(new Store(dir));
const persona = z.enum(["codex", "claude", "sonnet", "gemini"]);
const api = await controlServer(host, dir, () =>
  parent.postMessage({ type: "open" }),
);
host.on("state", (state) => parent.postMessage({ type: "state", state }));
const timer = setInterval(
  () => void host.supervisor.sleep(host.state.settings.idleMinutes),
  60000,
);
parent.on("message", async ({ data }: any) => {
  const { id, method, input } = data;
  try {
    let result: unknown;
    switch (method) {
      case "snapshot":
        result = host.state;
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
