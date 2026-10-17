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

// En del af søen: dønningen (rejst af et blæsevejr langt væk) eller
// vindsøen (rejst af vinden her). Højde m, topperiode s, retning grader fra.
export interface WavePart {
  hs: number;
  tp: number;
  dir: number;
}

// Modellernes spænd i højden for timen (api/openMeteo.ts): laveste og
// højeste bølgehøjde blandt de bølgemodeller, der havde et tal, og hvor
// mange. Vises som "±" og "usikker" (lib/spread.ts). Rører ikke scoren.
export interface HsSpread {
  lo: number;
  hi: number;
  n: number;
}

// Én times forhold, klar til scoring. Rækken bærer den SAMLEDE sø — det er
// den, der bryder på revlen — og delene står ved siden af, hvis kilden har
// dem (api/openMeteo.ts, docs/surf-science.md).
export interface Row {
  time: string; // ISO, Europe/Copenhagen
  hs: number; // samlet signifikant bølgehøjde m
  tp: number; // periode s: den dominerende dels topperiode, ellers samlet middel
  swdir: number; // samlet bølgeretning grader (hvor søen kommer fra)
  swell: WavePart | null; // dønningen, hvis modellen skiller den ud
  swell2?: WavePart | null; // den sekundære dønning (middelperiode), hvis hentet
  windSea: WavePart | null; // vindsøen, hvis hentet
  sst?: number | null; // vandtemperatur °C ved overfladen, hvis hentet
  level: number | null; // vandstand m over middel, hvis hentet
  hsSpread?: HsSpread | null; // modellernes spænd i højden, hvis hentet
  wdir: number; // vindretning grader
  wspd: number; // vind m/s
  gust: number; // stød m/s
  temp: number | null; // lufttemperatur °C
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function angDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Skæve bølger: energien aftager med vinklen mellem bølge og kyst som en
// cosinus, der først når nul ved OBLIQUE_CUTOFF grader — ikke ved 90. Til
// 13/10/2026 var det ren cos, og en bølge langs kysten (90°) gav nul. Den
// dag løb en sydbølge parallelt med kysten (DMI: 1,5 m fra S, vind SSV
// 10 m/s), og appen sagde "Bliv hjemme" ved Terrassen og 0 ved alle de
// NV-vendte Thyborøn-spots, mens en erfaren surfer pegede på netop stykket
// Langerhuse–Terrassen: man vælger størrelsen ved at gå nord eller syd.
// Bølger bøjer ind mod stranden på det lave vand, og høfder og revler
// fanger dem, så en bølge langs kysten giver surf — bare mindre. Med 140:
// 45° → 0,88, 90° → 0,53, 110° → 0,33, 130° → 0,11, fra 140° intet. En
// bølge ret på kysten er uændret 1, så kalibreringsankeret (26/7) holder.
// Det er en hypotese — loggen retter den, spot for spot.
export const OBLIQUE_CUTOFF = 140;

export function obliqueFactor(deltaDeg: number): number {
  if (deltaDeg >= OBLIQUE_CUTOFF) return 0;
  return Math.cos(((deltaDeg / OBLIQUE_CUTOFF) * Math.PI) / 2);
}

// Energi-indeks. Skaleret så 1,6 m / 7 s ≈ 269 (matcher surf-forecast.com's kJ).
export function energy(
  hs: number,
  tp: number,
  swdir: number,
  normal = SHORE_NORMAL
): number {
  return 15 * hs * hs * tp * obliqueFactor(angDiff(swdir, normal));
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
  // Hård fralandsvind (docs/surf-science.md, afsnit 5): over
  // OFFSHORE_IDEAL_MAX holder vinden bølgerne oppe, så de knækker sent og
  // tæt på stranden (Douglass 1990), og man kan ikke padle ind i dem.
  // Fradraget vokser til OFFSHORE_STRONG_PENALTY ved OFFSHORE_TOO_STRONG og
  // rammer kun vindens fralands-del. 11/10/2026: appen sagde over 7 i hård
  // fralandsvind og høje bølger, og bølgerne knækkede for langt inde.
  q -= offshoreStrength(wdir, wspd, offshore) * OFFSHORE_STRONG_PENALTY;
  return Math.max(0, Math.min(1, q));
}

// Hård pålandsvind (docs/surf-science.md, afsnit 5): lidt påland dæmper
// kun (gulvet på 0,35 i scoren), men over ONSHORE_BLOWOUT_FROM lige på
// land er søen blæst ud og rodet, og høfden giver intet læ. Fradraget vokser
// til ONSHORE_BLOWOUT_PENALTY ved ONSHORE_BLOWOUT_FULL og rammer kun vindens
// pålands-del (cos², så sidevind går fri — der har høfden læ). 14/10/2026:
// hård vestenvind, og gulvet stod på 3,5 uanset styrke.
export const ONSHORE_BLOWOUT_FROM = 6; // m/s
export const ONSHORE_BLOWOUT_FULL = 14; // m/s
export const ONSHORE_BLOWOUT_PENALTY = 0.7;

export function onshoreBlowout(wdir: number, wspd: number, normal: number): number {
  const along = Math.max(0, Math.cos((angDiff(wdir, normal) * Math.PI) / 180)); // 1 = lige på land
  const strong = clamp01((wspd - ONSHORE_BLOWOUT_FROM) / (ONSHORE_BLOWOUT_FULL - ONSHORE_BLOWOUT_FROM));
  return along * along * strong;
}

export const OFFSHORE_IDEAL_MAX = 5; // m/s (~10 knob): hertil er fralandsvind kun en gave
export const OFFSHORE_TOO_STRONG = 12; // m/s (~23 knob): herfra fuldt fradrag
export const OFFSHORE_STRONG_PENALTY = 0.6;

// Hvor hård fralandsvinden er, 0..1: fralands-andelen af vinden (cos til
// fralandsretningen, kvadreret, så en side-fralandsvind rammes blødt og
// aldrig ender under ren sidevind) gange styrken over det ideelle.
export function offshoreStrength(wdir: number, wspd: number, offshore: number): number {
  const along = Math.max(0, Math.cos((angDiff(wdir, offshore) * Math.PI) / 180));
  const strong = clamp01((wspd - OFFSHORE_IDEAL_MAX) / (OFFSHORE_TOO_STRONG - OFFSHORE_IDEAL_MAX));
  return along * along * strong;
}

// Refleksion fra en mole (docs/surf-science.md, afsnit 7): ved et spot op
// ad en lang mole kastes bølgerne tilbage, og den udadgående bølge spiser
// den næste. Virkningen vokser med højden: fra REFLECTION_FROM_HS til fuldt
// fradrag ved REFLECTION_FULL_HS. Kun spots med `reflective` (config/spots).
export const REFLECTION_FROM_HS = 1.0;
export const REFLECTION_FULL_HS = 2.0;
export const REFLECTION_MAX_PENALTY = 0.5;

export function reflectionFactor(hs: number): number {
  return 1 - REFLECTION_MAX_PENALTY * clamp01((hs - REFLECTION_FROM_HS) / (REFLECTION_FULL_HS - REFLECTION_FROM_HS));
}

// Vandstand (docs/surf-science.md, afsnit 6): revlen bryder bedst ved lav
// til middel vandstand. Står vandet højt, ruller bølgerne over revlen og
// knækker inde ved stranden; står det meget lavt, knækker de langt ude og
// hårdt. Tidevandet ved Thyborøn er kun en halv meter — det er vinden, der
// flytter vandet. Uden vandstand (null) regnes intet.
export const LEVEL_HIGH_FROM = 0.4; // m over middel
export const LEVEL_HIGH_FULL = 1.0;
export const LEVEL_HIGH_PENALTY = 0.4;
export const LEVEL_LOW_FROM = -0.6;
export const LEVEL_LOW_FULL = -1.2;
export const LEVEL_LOW_PENALTY = 0.15;

export function levelFactor(level: number | null): number {
  if (level == null) return 1;
  if (level > LEVEL_HIGH_FROM)
    return 1 - LEVEL_HIGH_PENALTY * clamp01((level - LEVEL_HIGH_FROM) / (LEVEL_HIGH_FULL - LEVEL_HIGH_FROM));
  if (level < LEVEL_LOW_FROM)
    return 1 - LEVEL_LOW_PENALTY * clamp01((LEVEL_LOW_FROM - level) / (LEVEL_LOW_FROM - LEVEL_LOW_FULL));
  return 1;
}

// Enkeltsidede spots (surfes kun på én side af høfden/molen, fx Høfde Q
// og Thorsminde — begge sydsiden):
// - Lægger vinden læ på spottets side, arbejder høfden FOR dig →
//   vindkvaliteten løftes til mindst SIDE_SHELTER_MIN (op til
//   SIDE_SHELTER_MAX_WIND m/s — derover hjælper læet ikke nok).
// - Lægger vinden læ på den FORKERTE side, står du i vinden på den side
//   der surfes → vindkvaliteten ganges med SIDE_MISMATCH.
// Indført 28/07/2026 efter brugerens observation: appen anbefalede
// Høfde Q "på nordsiden", som aldrig surfes.
export const SIDE_SHELTER_MIN = 0.75;
export const SIDE_MISMATCH = 0.5;
export const SIDE_SHELTER_MAX_WIND = 12;

// Høfdens læ er kun så godt, som vinden står på tværs af høfden: vind
// langs kysten (90° på spottets retning) giver fuldt læ, vind lige på land
// eller lige fra land (langs høfden) giver intet. 0..1.
// Tosidede høfdespots (Langerhuse, Terrassen, Sneglehuset) får læet også:
// man går på læsiden, og det er det, teksten "læ på nordsiden" lover.
// Indtil 14/10/2026 fik kun enkeltsidede spots løftet, så 13/10 kl. 12–14
// ved Langerhuse H (sydbølge, sydvind 10 m/s, "helt fantastisk") stod
// vinden som en ren sidevind på 0,44 i scoren, mens appen samtidig skrev
// "læ på nordsiden".
export function groyneShelter(wdir: number, normal: number): number {
  return Math.sin((angDiff(wdir, normal) * Math.PI) / 180);
}
// Kommer vinden fra land (inden for denne vinkel fra offshore), er hele
// kysten i læ, og høfdens side er ligegyldig: hverken løft eller straf.
export const OFFSHORE_SIDE_DEADZONE = 45;

export interface SpotOpts {
  offshore?: number; // se windQuality
  fixedSide?: "nord" | "syd"; // spottet surfes kun på denne side
  groynes?: boolean; // spottet har høfder, og man går på læsiden (groyneShelter)
  reflective?: boolean; // op ad en mole, der kaster bølgerne tilbage (reflectionFactor)
}

// Samme formel som scoreWest fra kalibreringen, men med kystnormalen som
// parameter så hvert spot i config/spots.ts kan have sin egen eksponering.
export function scoreSpot(r: Row, normal = SHORE_NORMAL, opts?: SpotOpts): number {
  const e = energy(r.hs, r.tp, r.swdir, normal);
  let wq = windQuality(r.wdir, r.wspd, normal, opts?.offshore ?? (normal + 180) % 360);
  if (!isOffshoreWind(r.wdir, normal)) {
    const shelter =
      r.wspd <= SIDE_SHELTER_MAX_WIND ? SIDE_SHELTER_MIN * groyneShelter(r.wdir, normal) : 0;
    if (opts?.fixedSide) {
      if (leeSide(r.wdir, normal) === opts.fixedSide) wq = Math.max(wq, shelter);
      else wq = wq * SIDE_MISMATCH;
    } else if (opts?.groynes) {
      wq = Math.max(wq, shelter);
    }
  }
  const eNorm = Math.min(1, e / ENERGY_NORM);
  const sizeGate = r.hs < SIZE_GATE_M ? r.hs / SIZE_GATE_M : 1;
  const gust = r.gust > GUST_LIMIT ? GUST_PENALTY : 1;
  const reflection = opts?.reflective ? reflectionFactor(r.hs) : 1;
  const blowout = 1 - ONSHORE_BLOWOUT_PENALTY * onshoreBlowout(r.wdir, r.wspd, normal);
  return (
    10 * Math.pow(eNorm, 0.6) * (0.35 + 0.65 * wq) * sizeGate * gust * reflection * levelFactor(r.level) * blowout
  );
}

// Hvorfor scoren er trukket ned: de regler, der er slået til for timen,
// med ord til kortet (short) og til tallene (text). Samme tærskler som
// reglerne selv, så en advarsel aldrig står uden et fradrag — eller omvendt.
export interface Caveat {
  key: "offshore-hard" | "onshore-hard" | "reflection" | "level-high" | "level-low";
  short: string;
  text: string;
}

export function caveats(r: Row, normal = SHORE_NORMAL, opts?: SpotOpts): Caveat[] {
  const out: Caveat[] = [];
  const offshore = opts?.offshore ?? (normal + 180) % 360;
  if (offshoreStrength(r.wdir, r.wspd, offshore) >= 0.3)
    out.push({
      key: "offshore-hard",
      short: "hård fralandsvind",
      text: "Hård fralandsvind: bølgerne holdes oppe, knækker sent og tæt på stranden, og de er svære at padle ind i."
    });
  if (onshoreBlowout(r.wdir, r.wspd, normal) >= 0.3)
    out.push({
      key: "onshore-hard",
      short: "hård pålandsvind",
      text: "Hård pålandsvind: søen er blæst ud og rodet, og høfden giver intet læ."
    });
  if (opts?.reflective && reflectionFactor(r.hs) < 0.9)
    out.push({
      key: "reflection",
      short: "molen kaster bølgerne tilbage",
      text: "Molen kaster bølgerne tilbage ved den størrelse: den udadgående bølge spiser den næste."
    });
  if (r.level != null && r.level > LEVEL_HIGH_FROM)
    out.push({
      key: "level-high",
      short: "høj vandstand",
      text: "Høj vandstand: bølgerne ruller over revlen og knækker inde ved stranden."
    });
  if (r.level != null && r.level < LEVEL_LOW_FROM)
    out.push({
      key: "level-low",
      short: "lav vandstand",
      text: "Lav vandstand: bølgerne knækker langt ude på yderrevlen, lavt og hårdt."
    });
  return out;
}

export const scoreWest = (r: Row) => scoreSpot(r, SHORE_NORMAL);

// Høfdens nordside: den af høfdens to sider, der vender nærmest nord.
// Høfden peger ud langs spottets retning (normal), så siderne vender mod
// normal ± 90°.
export function northSideDir(normal: number): number {
  const a = (normal + 90) % 360;
  const b = (normal + 270) % 360;
  return angDiff(a, 0) <= angDiff(b, 0) ? a : b;
}

// Hvilken side af høfden ligger i læ: den side, vinden IKKE kommer ind på.
// Kommer vinden fra nordsidens halvplan, er læet på sydsiden — og omvendt.
// Regnet ud fra spottets egen retning. (Til 10/10 var det ét fast vindue,
// 135–315° = nord, for alle spots; det lagde læet på nordsiden ved vind fra
// NV, hvor den i virkeligheden rammer nordsiden.) Tegningen og kortet
// bruger samme geometri, så det, der står, er det, der vises.
export function leeSide(wdir: number, normal: number): "nord" | "syd" {
  return angDiff(wdir, northSideDir(normal)) < 90 ? "syd" : "nord";
}

// Fralandsvind: inden for dødzonen fra offshore. Så er hele kysten i læ,
// og høfdens side er uden betydning — både for scoren og for teksten.
export function isOffshoreWind(wdir: number, normal: number): boolean {
  return angDiff(wdir, normal + 180) <= OFFSHORE_SIDE_DEADZONE;
}
