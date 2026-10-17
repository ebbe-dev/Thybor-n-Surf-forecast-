// Modellernes uenighed om højden — det ærligste mål for, hvor meget man
// skal tro på tallet, især dag 3-7. Rækken bærer spændet (hsSpread,
// api/openMeteo.ts); her regnes det, der vises: "1,5 ±0,4 m" og ordet
// "usikker", når modellerne er mere end SPREAD_UNSURE_M fra hinanden. Er
// de enige, står tallet alene. Uenigheden ændrer aldrig scoren.

import type { Row } from "../model/model";
import { fmt } from "./format";

export const SPREAD_UNSURE_M = 0.3; // uenige over så mange meter → usikker

export interface SpreadInfo {
  lo: number; // laveste højde blandt modellerne (og appens eget tal)
  hi: number;
  n: number; // modeller med et tal for timen
  pm: number; // halve spændet: det, der står efter ±
  unsure: boolean;
}

export function spreadOf(r: Pick<Row, "hs" | "hsSpread">): SpreadInfo | null {
  const s = r.hsSpread;
  if (!s || s.n < 2) return null;
  // appens eget tal (best_match) hører med i spændet
  const lo = Math.min(s.lo, r.hs);
  const hi = Math.max(s.hi, r.hs);
  return { lo, hi, n: s.n, pm: (hi - lo) / 2, unsure: hi - lo > SPREAD_UNSURE_M };
}

// "±0,4"
export const fmtPm = (s: SpreadInfo): string => `±${fmt(s.pm)}`;

// "1,1–1,9 m"
export const fmtRange = (s: SpreadInfo): string => `${fmt(s.lo)}–${fmt(s.hi)} m`;

// Højden, som den skal stå overalt: "1,5 ±0,4 m", når modellerne er
// uenige, ellers "1,5 m".
export function fmtHsWithSpread(r: Pick<Row, "hs" | "hsSpread">): string {
  const s = spreadOf(r);
  return s?.unsure ? `${fmt(r.hs)} ${fmtPm(s)} m` : `${fmt(r.hs)} m`;
}
