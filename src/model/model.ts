// =====================================================================
// SCORINGSMODELLEN — alle konstanter samlet her, ingen andre steder.
// Konstanterne er kalibreret mod faktiske sessions på stedet.
// Justér her når loggen bliver stor nok; komponenterne kalder kun
// funktionerne nedenfor og kender ikke tallene.
// =====================================================================

export const SHORE_NORMAL = 275; // stranden vender V/VNV
export const OFFSHORE = 95; // ØSØ

// Energi-normalisering: e/ENERGY_NORM klippes til 1 før potensen.
// Rekalibreret 28/07/2026 mod brugerens anker: søndag 26/7 kl. 17 ved
// Sneglehuset (1,3 m / 6,7 s NV ret på kysten, vind V 2,6 m/s) var en
// 10'er i virkeligheden. 1,3²·6,7·15 ≈ 169 → loftet sænket 250 → 170,
// så en ren mellemstor dag kan nå fuld energi.
export const ENERGY_NORM = 170;
// Vind under denne grænse (m/s) regnes gradvist som glas — kvadratisk,
// så 2-3 m/s næsten ikke straffer uanset retning (samme anker som ovenfor).
export const GLASS_WIND = 6;
// Under 0,5 m er det en gåtur — lineær gate op til denne højde.
export const SIZE_GATE_M = 0.5;
// Stød over denne grænse (m/s) koster 15 %.
export const GUST_LIMIT = 14;
export const GUST_PENALTY = 0.85;

// Én times forhold, klar til scoring. source fortæller om bølgetallene
// kommer fra swell-felterne eller er faldet tilbage på total vindsø.
export interface Row {
  time: string; // ISO, Europe/Copenhagen
  hs: number; // bølgehøjde m (swell eller total)
  tp: number; // periode s
  swdir: number; // bølgeretning grader
  wdir: number; // vindretning grader
  wspd: number; // vind m/s
  gust: number; // stød m/s
  temp: number | null; // lufttemperatur °C
  source: "swell" | "vindsø";
}

export function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Energi-indeks. Skaleret så 1,6 m / 7 s ≈ 269 (matcher surf-forecast.com's kJ).
// cos-leddet straffer skæve swellvinkler — en VSV-swell rammer skævt her.
export function energy(
  hs: number,
  tp: number,
  swdir: number,
  normal = SHORE_NORMAL
): number {
  const oblique = Math.max(0, Math.cos((angDiff(swdir, normal) * Math.PI) / 180));
  return 15 * hs * hs * tp * oblique;
}

// Vindkvalitet 0..1.
// Vigtigt: påland DÆMPER, det nulstiller ikke. Man kan sagtens surfe i lidt påland.
// Svag vind trækker altid mod glat vand uanset retning.
// N-kvadranten får bonus: efter et V/NV-blæsevejr drejer vinden nordi og høvler
// den resterende dønning ren. Det er stedets bedste opskrift.
// `offshore` kan overstyres pr. spot: ved refraktionsspots (Færgehavnen)
// er den glattende vindretning IKKE bare kystnormal+180, fordi bølgerne
// kommer bøjet ind fra en anden retning end den, land vender.
export function windQuality(
  wdir: number,
  wspd: number,
  normal = SHORE_NORMAL,
  offshore = (normal + 180) % 360
): number {
  let q = 1 - angDiff(wdir, offshore) / 180;
  // Kvadratisk glas-kurve (rekalibreret 28/07/2026, se ENERGY_NORM):
  // 2,6 m/s → 0,81, 4 m/s → 0,56, 6+ m/s → 0. Før: lineær med knæk ved 4.
  const calm = Math.max(0, 1 - (wspd / GLASS_WIND) ** 2);
  q = q + (1 - q) * calm;
  const north = angDiff(wdir, 350);
  if (north < 45 && wspd < 9) q += 0.15 * (1 - north / 45);
  return Math.max(0, Math.min(1, q));
}

// Samme formel som scoreWest fra kalibreringen, men med kystnormalen som
// parameter så hvert spot i config/spots.ts kan have sin egen eksponering.
export function scoreSpot(
  r: Row,
  normal = SHORE_NORMAL,
  offshore?: number
): number {
  const e = energy(r.hs, r.tp, r.swdir, normal);
  const wq = windQuality(r.wdir, r.wspd, normal, offshore ?? (normal + 180) % 360);
  const eNorm = Math.min(1, e / ENERGY_NORM);
  const sizeGate = r.hs < SIZE_GATE_M ? r.hs / SIZE_GATE_M : 1;
  const gust = r.gust > GUST_LIMIT ? GUST_PENALTY : 1;
  return 10 * Math.pow(eNorm, 0.6) * (0.35 + 0.65 * wq) * sizeGate * gust;
}

export const scoreWest = (r: Row) => scoreSpot(r, SHORE_NORMAL);

// Hvilken side af høfden ligger i læ
export const moleSide = (wdir: number): "nord" | "syd" =>
  wdir > 135 && wdir < 315 ? "nord" : "syd";
