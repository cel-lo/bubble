// All Walt frames: the first set (screens.mjs) plus the completion set (screens2.mjs).
import { SCREENS as A, ROWS as RA } from "./screens.mjs";
import { SCREENS2, ROWS2 } from "./screens2.mjs";
export const SCREENS = { ...A, ...SCREENS2 };
export const ROWS = [...RA, ...ROWS2];
