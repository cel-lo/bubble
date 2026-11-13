// Reads the composer shortcuts Walt handles itself (never sent to a model):
//   @Opus /effort high fix the date check     -> to Opus, effort high for this turn
//   @Opus /effort high keep                    -> Opus keeps effort high in this room
//   /model gpt-6.1-sol review this             -> model for this turn, whoever runs it
import { LEVELS, type Effort, type Persona, type PersonaDef } from "./model";

export interface Parsed {
  text: string;
  to?: Persona;
  effort?: Effort;
  model?: string;
  keep: boolean;
}
/** model ids reach the CLI as one argv entry; plain id characters only */
export const MODEL_ID = /^[\w.:/-]{1,80}$/;
const END = String.raw`(?=$|[\s,.:;!?])`;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** names a persona answers to: its id, its full name, and the last or first word of the name when that is unique ("@Opus", "@Haiku") */
export function aliases(personas: PersonaDef[]) {
  const word = (p: PersonaDef, i: 0 | -1) => p.name.trim().split(/\s+/).at(i)!.toLowerCase();
  const out: [string, Persona][] = [];
  for (const p of personas) {
    out.push([p.id.toLowerCase(), p.id], [p.name.toLowerCase(), p.id]);
    for (const i of [-1, 0] as const) if (personas.filter((q) => word(q, i) === word(p, i)).length === 1) out.push([word(p, i), p.id]);
  }
  return out.sort((a, b) => b[0].length - a[0].length);
}

export function parseMessage(input: string, personas: PersonaDef[]): Parsed {
  let text = input;
  let to: Persona | undefined;
  for (const [alias, id] of aliases(personas)) {
    const re = new RegExp(`@${escapeRe(alias)}${END}`, "gi");
    if (!re.test(text)) continue;
    if (to && to !== id) throw new Error("Mention one persona per message.");
    to = id;
    text = text.replace(re, " ");
  }
  const leftover = text.match(/@[\w.-]+/);
  if (leftover && !to) throw new Error(`No persona called ${leftover[0]} in Walt.`);
  let effort: Effort | undefined, model: string | undefined, keep = false;
  text = text.replace(/(?:\buse\s+)?\/effort(?:\s+(\S+))?(\s+keep\b)?/gi, (_, v: string | undefined, k) => {
    if (!v || !LEVELS.includes(v.toLowerCase() as Effort)) throw new Error(`/effort needs one of: ${LEVELS.join(", ")}.`);
    effort = v.toLowerCase() as Effort;
    keep ||= !!k;
    return " ";
  });
  text = text.replace(/(?:\buse\s+)?\/model(?:\s+(\S+))?(\s+keep\b)?/gi, (_, v: string | undefined, k) => {
    if (!v) throw new Error("/model needs a model id, e.g. /model opus.");
    if (!MODEL_ID.test(v)) throw new Error("Model id may only use letters, digits and . : / - _ (max 80).");
    model = v;
    keep ||= !!k;
    return " ";
  });
  return { text: text.replace(/[ \t]+/g, " ").replace(/^\s+|\s+$/g, ""), to, effort, model, keep };
}

/** a question the AI ended its reply with: "DECISION: <question>" then 2–4 "- option" lines; undefined when there is none */
export function decision(text: string) {
  const lines = text.trimEnd().split(/\r?\n/);
  const at = lines.map((l) => /^\s*\**DECISION:?\**\s*/i.test(l)).lastIndexOf(true);
  if (at < 0) return undefined;
  const question = lines[at].replace(/^\s*\**DECISION:?\**\s*/i, "").trim();
  const options = lines.slice(at + 1).filter((l) => l.trim()).map((l) => l.match(/^\s*[-*•]\s+(.+)$/)?.[1]?.trim());
  if (!question || options.length < 2 || options.length > 4 || options.some((o) => !o)) return undefined;
  return { question, options: options as string[] };
}
