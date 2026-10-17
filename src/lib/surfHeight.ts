// Bølgens front på revlen: det, surferen ser fra stranden, regnet af det,
// modellen og bøjen ser ude på havet. Komar & Gaughan (1972), lineær teori
// med breaker-indeks 0,78: Hb = 0,39 · g^(1/5) · (T · H0²)^(2/5). Uden
// refraktion og bundfriktion — en åben strand, ikke et bestemt spot. Det
// er perioden, der laver bølgen: 1,5 m giver ~1,7 m front ved 6 s og
// ~2,1 m ved 10 s. Vises som et tal (Ebbe 17/10: "hellere m og cm end
// ord") og kan slås fra under Indstillinger på NU. Scoren bruger stadig
// hs²·tp og rører ikke det her. docs/surf-science.md §13.

import { fmt } from "./format";

const G = 9.81;

// Signifikant brydningshøjde i meter af samlet højde (m) og periode (s).
export function breakerHeight(hs: number, tp: number): number {
  if (!(hs > 0) || !(tp > 0)) return 0;
  return 0.39 * Math.pow(G, 0.2) * Math.pow(tp * hs * hs, 0.4);
}

// Fronten af en række: samme tal, uanset hvor i appen den står.
export function frontOf(r: { hs: number; tp: number }): number {
  return breakerHeight(r.hs, r.tp);
}

// "1,7 m" fra en meter og op; under en meter i hele 5 cm: "85 cm".
export function fmtSurfHeight(m: number): string {
  const cm = Math.round((m * 100) / 5) * 5;
  if (cm >= 100) return `${fmt(m)} m`;
  return `${cm} cm`;
}
