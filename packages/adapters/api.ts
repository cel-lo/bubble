// API adapter: any OpenAI-compatible chat API (Groq, 9Router, OpenRouter …), streamed over HTTPS.
// No process and no tools: the model talks, it cannot read or change the project. Walt keeps the conversation
// here (the API has no sessions); a new session gets the chat so far from the host.
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import type { ModelInfo } from "../domain/model";
import type { Approval } from "./claude";

export interface ApiTarget {
  baseUrl: string;
  key?: string;
}
const url = (t: ApiTarget, path: string) => t.baseUrl.replace(/\/+$/, "") + path;
const headers = (t: ApiTarget) => ({ "content-type": "application/json", ...(t.key ? { authorization: `Bearer ${t.key}` } : {}) });
/** the API's error, short, without anything that looks like a key */
async function failure(res: Response) {
  const body = (await res.text().catch(() => "")).replace(/\b(sk|gsk|or)-[\w-]{8,}/g, "[key]").slice(0, 400);
  let msg = body;
  try {
    msg = JSON.parse(body).error?.message ?? body;
  } catch {}
  return new Error(`${res.status} ${res.statusText}: ${msg}`.trim());
}

/** models the key can use (GET /models), without speech, embedding and moderation models */
export async function apiModels(t: ApiTarget, timeoutMs = 15000): Promise<ModelInfo[]> {
  const res = await fetch(url(t, "/models"), { headers: headers(t), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw await failure(res);
  const data: any[] = (await res.json()).data ?? [];
  return data
    .map((m) => String(m.id ?? ""))
    .filter((id) => id && !/whisper|tts|embed|guard|moderation|transcri|speech|dall-e|image/i.test(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id.split("/").pop()!, efforts: [] }));
}

type Msg = { role: "system" | "user" | "assistant"; content: unknown };
/** pull the text out of an SSE stream of chat.completion.chunk events */
export async function* sseText(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    buf += dec.decode(value, { stream: !done });
    const lines = buf.split(/\r?\n/);
    buf = done ? "" : lines.pop()!;
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (data === "[DONE]") return;
      try {
        const e = JSON.parse(data);
        if (e.error) throw new Error(e.error.message ?? JSON.stringify(e.error));
        const piece = e.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece) yield piece;
      } catch (err) {
        if (err instanceof SyntaxError) continue;
        throw err;
      }
    }
    if (done) return;
  }
}

export class ApiSession {
  readonly pid = undefined;
  sessionId?: string;
  lastActive = Date.now();
  private history: Msg[] = [];
  private abort?: AbortController;
  private running = false;
  private stopped = false;
  constructor(
    private readonly target: ApiTarget,
    readonly model: string,
    /** Customize · Instructions plus what Walt tells every API model */
    private readonly system: string,
    readonly effort?: string,
  ) {}
  /** no conversation yet: the host sends the chat so far with the first message */
  get fresh() {
    return !this.history.length;
  }
  get alive() {
    return !this.stopped;
  }
  get busy() {
    return this.running;
  }
  async run(prompt: string, delta: (text: string) => void, _approve: Approval, images: string[] = []) {
    if (!this.model) throw new Error("Pick a model for this API first (Customize · AI & models).");
    this.running = true;
    this.abort = new AbortController();
    const pics = images.map((f) => ({ type: "image_url", image_url: { url: `data:image/${extname(f).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(f).toString("base64")}` } }));
    const user: Msg = { role: "user", content: pics.length ? [{ type: "text", text: prompt }, ...pics] : prompt };
    let text = "";
    try {
      const res = await fetch(url(this.target, "/chat/completions"), {
        method: "POST",
        headers: headers(this.target),
        body: JSON.stringify({ model: this.model, stream: true, messages: [...(this.system ? [{ role: "system", content: this.system }] : []), ...this.history, user] }),
        signal: this.abort.signal,
      });
      if (!res.ok || !res.body) throw await failure(res);
      for await (const piece of sseText(res.body)) {
        text += piece;
        delta(piece);
      }
      // pictures are sent once; later turns keep only the words
      this.history.push({ role: "user", content: prompt + (pics.length ? `\n[${pics.length} picture(s) attached]` : "") }, { role: "assistant", content: text });
      // shortcut: the last 40 messages only, so a long chat stays under the context limit; summarise if that bites
      this.history = this.history.slice(-40);
      return text;
    } catch (e) {
      if (this.abort.signal.aborted) return text || "(stopped)";
      throw e;
    } finally {
      this.running = false;
      this.lastActive = Date.now();
    }
  }
  interrupt() {
    this.abort?.abort();
  }
  async stop() {
    this.stopped = true;
    this.interrupt();
  }
}
