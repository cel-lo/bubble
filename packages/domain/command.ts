// Reads the composer shortcuts Walt handles itself (never sent to a model):
//   @Opus /effort high fix the date check     -> to Opus, effort high for this turn
//   @Opus /effort high keep                    -> Opus keeps effort high in this room
//   /model gpt-6.1-sol review this             -> model for this turn, whoever runs it
import { LEVELS, type Effort, type Persona, type PersonaDef } from "./model";

export interface Parsed {
  text: string;
  /** the first persona mentioned (undefined when none) */
  to?: Persona;
  /** every persona mentioned, in the order written: two or more answer at the same time */
  tos: Persona[];
  /** the message as written, @names included (several answering need it to find their own part) */
  said?: string;
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
  const found: { id: Persona; at: number }[] = [];
  for (const [alias, id] of aliases(personas)) {
    const re = new RegExp(`@${escapeRe(alias)}${END}`, "gi");
    const at = text.search(re);
    if (at < 0) continue;
    if (!found.some((f) => f.id === id)) found.push({ id, at });
    text = text.replace(re, " ");
  }
  const tos = found.sort((a, b) => a.at - b.at).map((f) => f.id);
  const to = tos[0];
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
  return { text: text.replace(/[ \t]+/g, " ").replace(/^\s+|\s+$/g, ""), to, tos, effort, model, keep, ...(tos.length > 1 && { said: input.trim() }) };
}

/** a CLI error that means the subscription's usage limit was hit; `reset` = when it says it resets, if it does.
 * Claude Code: "Claude AI usage limit reached|<unix time>" or "…limit reached ∙ resets 3pm"; Codex: "You've hit your
 * usage limit… try again at 3:05 PM". shortcut: matched on wording (no CLI gives a code for it), so a new wording is
 * shown as a plain error until it is added here. */
export function usageLimit(text: string): { reset?: string } | undefined {
  if (!/usage limit|hit your (usage )?limit|limit reached|rate limit|quota exceeded|too many requests|\b429\b/i.test(text)) return undefined;
  const epoch = text.match(/limit reached\|(\d{10})/i);
  if (epoch) return { reset: new Date(+epoch[1] * 1000).toLocaleString("sv-SE").slice(0, 16) };
  const at = text.match(/(?:resets?|try again)(?: at| in)?\s+([^.\n(]{1,40})/i);
  return { reset: at?.[1].trim() };
}
/** one line of plain text (no Markdown marks, no line breaks): how the island shows and sends back a decision */
export const plain = (s: string, n = 200) => s.replace(/[`*_#>|]/g, "").replace(/\s+/g, " ").trim().slice(0, n);
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
/** what a task asks for, and which "Good at" words answer it */
const NEEDS: [task: RegExp, good: RegExp][] = [
  [/\b(tests?|specs?|coverage|failing|flaky)\b/i, /test/i],
  [/\b(implement|add|build|feature|endpoint|function|fix|bug|crash|error)\b/i, /code|feature|fix/i],
  [/\b(refactor|clean ?up|rename|simplify|split|merge)\b/i, /refactor|code/i],
  [/\b(plan|design|architect\w*|structure|approach|migrat\w*|why)\b/i, /plan|architect/i],
  [/\b(review|audit|check|security|risk)\b/i, /review|audit/i],
  [/\b(docs?|readme|copy|wording|text|translat\w*|comment|explain)\b/i, /doc|copy|writ/i],
  [/\b(ui|ux|css|layout|button|page|screen|style|design)\b/i, /\bui\b|front|copy|design/i],
  [/\b(research|compare|investigate|long|big file)\b/i, /research|long|opinion/i],
];
/** Auto roles: the team member whose "Good at" best fits the task; ties keep the current builder */
export function autoBuilder(task: string, team: { id: string; strengths: string[] }[], current: string) {
  let best = { id: current, score: 0, why: "" };
  const score = (s: string[]) => {
    const hit = NEEDS.filter(([t, g]) => t.test(task) && s.some((x) => g.test(x)));
    return { score: hit.length, why: s.find((x) => hit.some(([, g]) => g.test(x))) ?? "" };
  };
  const cur = team.find((p) => p.id === current);
  if (cur) best = { id: current, ...score(cur.strengths) };
  for (const p of team) {
    const s = score(p.strengths);
    if (s.score > best.score) best = { id: p.id, ...s };
  }
  return best;
}
