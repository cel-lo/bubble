// API adapter: any OpenAI-compatible chat API (9Router, Groq, OpenRouter …), streamed over HTTPS; xAI (Grok) goes
// through its Responses API with web and X search on, so answers can use what was posted minutes ago.
// No process and no project tools: the model talks, it cannot read or change the project. Bubble keeps the
// conversation here (the API has no sessions); a new session gets the chat so far from the host.
// Every call leaves `lastCall`: tokens in and out, search tools used, time, result (Customize · AI & models shows it).
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { isXai, type ApiCall, type ModelInfo } from "../domain/model";
import type { Approval } from "./claude";

export interface ApiTarget {
  baseUrl: string;
  key?: string;
  /** use xAI's Responses API with search (default: when the address is api.x.ai) */
  xai?: boolean;
}
const url = (t: ApiTarget, path: string) => t.baseUrl.replace(/\/+$/, "") + path;
const headers = (t: ApiTarget) => ({ "content-type": "application/json", ...(t.key ? { authorization: `Bearer ${t.key}` } : {}) });
/** the API's error, short, without anything that looks like a key */
async function failure(res: Response) {
  const body = (await res.text().catch(() => "")).replace(/\b(sk|gsk|or|xai)-[\w-]{8,}/g, "[key]").slice(0, 400);
  let msg = body;
  try {
    msg = JSON.parse(body).error?.message ?? JSON.parse(body).error ?? body;
  } catch {}
  return new Error(`${res.status} ${res.statusText}: ${typeof msg === "string" ? msg : JSON.stringify(msg)}`.trim());
}

/** models the key can use (GET /models), without speech, embedding and moderation models */
export async function apiModels(t: ApiTarget, timeoutMs = 15000): Promise<ModelInfo[]> {
  const res = await fetch(url(t, "/models"), { headers: headers(t), signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw await failure(res);
  const data: any[] = (await res.json()).data ?? [];
  return data
    .map((m) => String(m.id ?? ""))
    .filter((id) => id && !/whisper|tts|embed|guard|moderation|transcri|speech|dall-e|image|imagine|video/i.test(id))
    .sort((a, b) => a.localeCompare(b))
    .map((id) => ({ id, label: id.split("/").pop()!, efforts: [] }));
}

type Msg = { role: "system" | "user" | "assistant"; content: unknown };
/** the JSON events of a server-sent event stream, until [DONE] */
export async function* sse(body: ReadableStream<Uint8Array>): AsyncGenerator<any> {
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
      let e: any;
      try {
        e = JSON.parse(data);
      } catch {
        continue;
      }
      yield e;
    }
    if (done) return;
  }
}
/** the error an event carries (chat completions: { error }; Responses API: type error / response.failed) */
const eventError = (e: any) => (e.error ? e.error.message ?? JSON.stringify(e.error) : e.type === "error" ? e.message ?? "error" : e.type === "response.failed" ? e.response?.error?.message ?? "the response failed" : "");

export class ApiSession {
  readonly pid = undefined;
  sessionId?: string;
  lastActive = Date.now();
  /** the latest call: what the API reported for it (cleared at the start of each run) */
  lastCall?: ApiCall;
  private history: Msg[] = [];
  private abort?: AbortController;
  private running = false;
  private stopped = false;
  constructor(
    private readonly target: ApiTarget,
    readonly model: string,
    /** Customize · Instructions plus what Bubble tells every API model */
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
  private post(path: string, body: unknown) {
    return fetch(url(this.target, path), { method: "POST", headers: headers(this.target), body: JSON.stringify(body), signal: this.abort!.signal });
  }
  async run(prompt: string, delta: (text: string) => void, _approve: Approval, images: string[] = []) {
    if (!this.model) throw new Error("Pick a model for this API first (Customize · AI & models).");
    const xai = this.target.xai ?? isXai(this.target.baseUrl);
    const call: ApiCall = { model: this.model, ms: 0, ok: false };
    this.lastCall = call;
    const started = Date.now();
    this.running = true;
    this.abort = new AbortController();
    const pics = images.map((f) => `data:image/${extname(f).slice(1).replace("jpg", "jpeg")};base64,${readFileSync(f).toString("base64")}`);
    const user: Msg = {
      role: "user",
      content: !pics.length
        ? prompt
        : xai
          ? [{ type: "input_text", text: prompt }, ...pics.map((u) => ({ type: "input_image", image_url: u }))]
          : [{ type: "text", text: prompt }, ...pics.map((u) => ({ type: "image_url", image_url: { url: u } }))],
    };
    const messages = [...(this.system ? [{ role: "system", content: this.system }] : []), ...this.history, user];
    let text = "";
    try {
      let res = xai
        ? await this.post("/responses", { model: this.model, stream: true, input: messages, tools: [{ type: "web_search" }, { type: "x_search" }] })
        : await this.post("/chat/completions", { model: this.model, stream: true, stream_options: { include_usage: true }, messages });
      // a server that refuses stream_options gets the plain request (no token counts then)
      if (!xai && res.status === 400) {
        const err = await failure(res);
        if (!/stream_options|include_usage/i.test(err.message)) throw err;
        res = await this.post("/chat/completions", { model: this.model, stream: true, messages });
      }
      if (!res.ok || !res.body) throw await failure(res);
      for await (const e of sse(res.body)) {
        const bad = eventError(e);
        if (bad) throw new Error(bad);
        const piece = xai ? (e.type === "response.output_text.delta" ? e.delta : undefined) : e.choices?.[0]?.delta?.content;
        if (typeof piece === "string" && piece) {
          text += piece;
          delta(piece);
        }
        const u = xai ? (e.type === "response.completed" || e.type === "response.incomplete" ? e.response?.usage : undefined) : e.usage;
        if (u) {
          call.input = u.input_tokens ?? u.prompt_tokens;
          call.output = u.output_tokens ?? u.completion_tokens;
          const tools = Object.entries(u.server_side_tool_usage_details ?? {}).filter(([, v]) => typeof v === "number" && v > 0);
          if (tools.length) call.tools = Object.fromEntries(tools) as Record<string, number>;
        }
      }
      // Grok cites as [[1]](url); make them ordinary links so they open in the Browser
      if (xai) text = text.replace(/\[\[(\d+)\]\]\(/g, "[$1](");
      call.ok = true;
      // pictures are sent once; later turns keep only the words
      this.history.push({ role: "user", content: prompt + (pics.length ? `\n[${pics.length} picture(s) attached]` : "") }, { role: "assistant", content: text });
      // shortcut: the last 40 messages only, so a long chat stays under the context limit; summarise if that bites
      this.history = this.history.slice(-40);
      return text;
    } catch (e) {
      if (this.abort.signal.aborted) {
        call.error = "stopped";
        return text || "(stopped)";
      }
      call.error = String((e as Error).message ?? e).slice(0, 300);
      throw e;
    } finally {
      call.ms = Date.now() - started;
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
