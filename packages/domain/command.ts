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

/** names a persona answers to: its id, its full name, and the last word of the name when that is unique */
export function aliases(personas: PersonaDef[]) {
  const last = (p: PersonaDef) => p.name.trim().split(/\s+/).at(-1)!.toLowerCase();
  const out: [string, Persona][] = [];
  for (const p of personas) {
    out.push([p.id.toLowerCase(), p.id], [p.name.toLowerCase(), p.id]);
    if (personas.filter((q) => last(q) === last(p)).length === 1) out.push([last(p), p.id]);
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
