// Ground swell eller wind swell — det, man spørger om, før man kører. Det
// afgøres af perioden, som surfere gør det: lange perioder er dønning rejst
// af et blæsevejr langt væk (ordnede, kraftfulde bølger), korte er sø rejst
// af vinden tæt på. Grænsen ligger ved 8 s: Nordsøen er et lille hav, så
// Atlanterhavets 10-12 s kommer næsten aldrig, og appens hjælp har hele
// tiden kaldt 8+ "kraft og orden".
//
// Open-Meteos dønnings-del (Row.swell) siger kun, at modellen kunne skille
// dønningen fra vindsøen — ikke om den er lang. En nyligt rejst dønning på
// 5 s er stadig wind swell. Derfor regnes typen af perioden alene, og det
// virker også på et session-snapshot, der kun har tallene.

import type { Row, WavePart } from "../model/model";

export const GROUND_SWELL_MIN_TP = 8; // s

export type SwellKind = "ground" | "wind";

// Perioden, som den står på skærmen: én decimal (fmt). Mærket og skalaen
// regnes af DEN — ellers kunne der stå "wind swell" ved "8,0 s", fordi
// modellen sagde 7,96.
export function displayedPeriod(tp: number): number {
  return Number(tp.toFixed(1));
}

export function swellKind(tp: number): SwellKind {
  return displayedPeriod(tp) >= GROUND_SWELL_MIN_TP ? "ground" : "wind";
}

export function swellLabel(kind: SwellKind): string {
  return kind === "ground" ? "Ground swell" : "Wind swell";
}

// Ground swell UNDER vindsøen (17/10/2026): rækkens periode er den
// dominerende dels, så en lang dønning på et par decimeter under en større
// vindsø får mærket wind swell. Ligger der en dønnings-del (den primære
// eller den sekundære) med lang periode og mindst UNDER_MIN_HS, siger appen
// det ved siden af mærket: der er orden i søen alligevel. Kun når rækken
// selv siger wind swell — ellers er det bare ground swell.
export const UNDER_MIN_HS = 0.3; // m

export function groundSwellUnder(r: Pick<Row, "tp" | "swell" | "swell2">): WavePart | null {
  if (swellKind(r.tp) === "ground") return null;
  const parts = [r.swell, r.swell2 ?? null].filter(
    (p): p is WavePart => p !== null && p.hs >= UNDER_MIN_HS && swellKind(p.tp) === "ground"
  );
  if (parts.length === 0) return null;
  return parts.reduce((a, b) => (b.hs > a.hs ? b : a));
}

// Skalaen under tallene: fra plaskeri til lang dønning. Grænsen står midt på.
export const GAUGE_MIN_TP = 3;
export const GAUGE_MAX_TP = 13;

// Hvor på skalaen perioden ligger, 0..1. Uden for enderne klemmes den ind.
export function gaugePosition(tp: number): number {
  const p = (displayedPeriod(tp) - GAUGE_MIN_TP) / (GAUGE_MAX_TP - GAUGE_MIN_TP);
  return Math.min(1, Math.max(0, p));
}
