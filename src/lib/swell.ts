// Ground swell eller wind swell — det, man spørger om, før man kører. Det
// afgøres af perioden, som surfere gør det: lange perioder er dønning rejst
// af et blæsevejr langt væk (ordnede, kraftfulde bølger), korte er sø rejst
// af vinden tæt på. Grænsen ligger ved 8 s: Nordsøen er et lille hav, så
// Atlanterhavets 10-12 s kommer næsten aldrig, og appens hjælp har hele
// tiden kaldt 8+ "kraft og orden".
//
// Open-Meteos swell-felter (Row.source) siger kun, at modellen kunne skille
// dønningen fra vindsøen — ikke om den er lang. En nyligt rejst dønning på
// 5 s er stadig wind swell. Derfor regnes typen af perioden alene, og det
// virker også på et session-snapshot, der kun har tallene.

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

// Skalaen under tallene: fra plaskeri til lang dønning. Grænsen står midt på.
export const GAUGE_MIN_TP = 3;
export const GAUGE_MAX_TP = 13;

// Hvor på skalaen perioden ligger, 0..1. Uden for enderne klemmes den ind.
export function gaugePosition(tp: number): number {
  const p = (displayedPeriod(tp) - GAUGE_MIN_TP) / (GAUGE_MAX_TP - GAUGE_MIN_TP);
  return Math.min(1, Math.max(0, p));
}
