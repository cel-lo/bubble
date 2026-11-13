// UI text is written in English; t() swaps in the Indonesian line from id.ts when the locale is "id".
// A missing entry falls back to English, so a new string never shows up blank. {0}, {1} are filled from the arguments.
import { ID } from "./id";
let locale = "en";
/** App calls this on every render with settings.locale */
export const setLocale = (l: string) => void (locale = l);
export const t = (s: string, ...a: (string | number)[]) => ((locale === "id" && ID[s]) || s).replace(/\{(\d)\}/g, (_: string, i: string) => String(a[+i] ?? ""));
