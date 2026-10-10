// Spots ned langs tangen. Tilføj en høfde ved at tilføje et objekt —
// hver høfde kan have sin egen kystnormal, de eksponeres forskelligt.

export interface Spot {
  id: string;
  name: string;
  shortName: string; // til dommen og knapper
  area: string; // hvilket vejr-område (AREAS) spottet hører til
  shoreNormal: number; // grader kysten vender imod
  lat: number;
  lon: number;
  // Glattende vindretning hvis den afviger fra kystnormal+180 —
  // refraktionsspots hvor bølger og vind har forskellig geometri.
  offshoreDir?: number;
  // Spottet surfes kun på denne side af høfden/molen (se model.ts,
  // SIDE_SHELTER/SIDE_MISMATCH).
  fixedSide?: "nord" | "syd";
  // Retningen er et gæt: NU siger det, til den er tjekket på kortet.
  // (Sted og retning kan tjekkes og rettes på kortet for ALLE spots.)
  adjustableNormal?: boolean;
  uncalibrated?: boolean; // vis "ukalibreret" i UI'et
  warning?: string; // fast advarsel, vises altid på spottet
  // Tegn en høfderække på kortet: antal streger, afstand og længde i meter.
  // Prikken (lat/lon) står på høfdens SPIDS; høfden løber lengthM ind mod
  // land, og læet regnes af den (lib/geo.ts).
  groynes?: { count: number; spacingM: number; lengthM: number };
}

// Vejr-områder: spots deler bølge- og vindpunkt inden for et område.
// Thyborøn-punktet er verificeret vådt i produktion 28/07/2026; syd-punktet
// ligger ~7 km offshore og bør være vådt — er det tørt, viser appen det
// pr. område i stedet for at fejle det hele.
export interface Area {
  id: string;
  label: string;
  wave: { lat: number; lon: number };
  wind: { lat: number; lon: number };
}

export const AREAS: Area[] = [
  {
    id: "thyboroen",
    label: "Thyborøn",
    wave: { lat: 56.66, lon: 8.13 },
    wind: { lat: 56.68, lon: 8.2 }
  },
  {
    id: "thorsminde",
    label: "Bovbjerg/Thorsminde",
    wave: { lat: 56.45, lon: 8.0 },
    wind: { lat: 56.45, lon: 8.12 }
  }
];

// Alle positioner er bekræftet af brugeren 28/07/2026 (Udkigsposten
// med præcis nål, resten visuelt på kortet). Kystnormalerne for de
// ukalibrerede spots justeres i appen. id'erne må ikke ændres
// (localStorage-nøgler).

export const SPOTS: Spot[] = [
  {
    // Historisk id "vestkysten" — brugerens tidlige sessions peger på det.
    id: "vestkysten",
    name: "Langerhuse Højre — høfden ved fiskemolen",
    shortName: "Langerhuse H",
    area: "thyboroen",
    shoreNormal: 275, // kalibreret mod faktiske sessions
    lat: 56.6304935, // brugerens nål på fiskemolen, 28/07/2026
    lon: 8.1522159,
    groynes: { count: 3, spacingM: 250, lengthM: 130 }
  },
  {
    id: "langerhuse-venstre",
    name: "Langerhuse Venstre — høfden ved Flyvholm Redningsstation",
    shortName: "Langerhuse V",
    area: "thyboroen",
    shoreNormal: 275, // samme kyststrækning, samme kalibrering
    lat: 56.6244138, // brugerens nål på Flyvholm Redningsstation, 28/07/2026
    lon: 8.1505821,
    groynes: { count: 3, spacingM: 250, lengthM: 130 }
  },
  {
    // id bevares af hensyn til sessions/localStorage — kun navnet er ændret.
    id: "udkigsposten",
    name: "Terrassen (mellem Langerhuse og Thyborøn)",
    shortName: "Terrassen",
    area: "thyboroen",
    shoreNormal: 285, // skøn: kysten er begyndt at dreje mod NV her
    lat: 56.6936676, // brugerens opdaterede nål, 28/07/2026
    lon: 8.1934475,
    groynes: { count: 5, spacingM: 250, lengthM: 130 }
  },
  {
    id: "sneglehuset",
    name: "Sneglehuset (NV-stranden ved Thyborøn by)",
    shortName: "Sneglehuset",
    area: "thyboroen",
    shoreNormal: 300, // NV-vendt bue før kanalmundingen
    lat: 56.697106, // brugerens nål, 28/07/2026
    lon: 8.1969682,
    groynes: { count: 5, spacingM: 220, lengthM: 120 }
  },
  {
    id: "indsejlingen",
    name: "Indsejlingen (kanalmundingen)",
    shortName: "Indsejlingen",
    area: "thyboroen",
    // Kalibreret 28/07/2026: brugerens pil på satellitfoto viser bølgerne
    // ind fra NV (~322°) gennem mundingen — rundet til 320.
    shoreNormal: 320,
    lat: 56.7089371, // brugerens nål, 28/07/2026
    lon: 8.2171907,
    adjustableNormal: true
  },
  {
    id: "faergehavnen",
    name: "Den gamle færgehavn (øst for Thyborøn by)",
    shortName: "Færgehavnen",
    area: "thyboroen",
    // Kalibreret 28/07/2026 af brugerens foto-pile: bugten åbner mod NNØ,
    // bølgerne refrakteres ned gennem kanalen og hooker ind. SPECIELT:
    // vestenvind er offshore her (land mod vest), selvom bølgerne kommer
    // nordfra — derfor egen offshoreDir i stedet for normal+180.
    shoreNormal: 30,
    offshoreDir: 270,
    lat: 56.6903646, // brugerens nål, 28/07/2026
    lon: 8.2265966,
    adjustableNormal: true
  },
  // ---- Sydområdet (Bovbjerg/Thorsminde), nord → syd.
  // (Fjaltring udgik 28/07/2026 — det VAR Høfde Q, samme sted.)
  {
    // Researchet 28/07/2026 (visitnordvestkysten/comevisit): klassisk
    // HØJRE-bølge, lang og hul på gode dage; der surfes SYD for høfden
    // (ind på indersiden af sydsiden, padl ud til takeoff). Sydenden med
    // de sidste 3-4 høfder er bedst. Niveau: øvet/ekspert.
    id: "hoefde-q",
    name: "Høfde Q — højre, surfes syd for høfden (Fjaltring)",
    shortName: "Høfde Q",
    area: "thorsminde",
    shoreNormal: 270, // kysten løber ret N-S her
    lat: 56.4762505, // brugerens nål, 28/07/2026
    lon: 8.1215395,
    adjustableNormal: true,
    fixedSide: "syd", // surfes KUN syd for høfden
    groynes: { count: 4, spacingM: 250, lengthM: 150 }
  },
  {
    // Brugerens spotviden 28/07/2026: højre-bølge — man surfer mod syd
    // langs den store mole.
    id: "thorsminde",
    name: "Thorsminde — højre langs den store mole (surfes mod syd)",
    shortName: "Thorsminde",
    area: "thorsminde",
    shoreNormal: 270, // kysten løber ret N-S her
    lat: 56.3704838, // brugerens nål, 28/07/2026
    lon: 8.1142532,
    adjustableNormal: true,
    fixedSide: "syd" // surfes langs den store mole, mod syd
  }
];

const NORMAL_KEY = "bygtangen.normal.";
const POS_KEY = "bygtangen.pos.";
const CHECKED_KEY = "bygtangen.checked.";

// Effektiv kystnormal: brugerens rettelse fra kortet, hvis der er én,
// ellers configværdien. Gælder alle spots (indtil 10/10 kun gætte-spots).
export function effectiveNormal(spot: Spot): number {
  const v = localStorage.getItem(NORMAL_KEY + spot.id);
  if (v !== null) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n < 360) return n;
  }
  return spot.shoreNormal;
}

export function setNormal(spot: Spot, deg: number): void {
  localStorage.setItem(NORMAL_KEY + spot.id, String(((deg % 360) + 360) % 360));
}

// Effektiv position: dér brugeren har trukket prikken hen på kortet, hvis
// den er flyttet; ellers configværdien. Bruges kun af kortet (nål og
// høfder) — vejrpunkterne er pr. område.
export function effectivePosition(spot: Spot): { lat: number; lon: number } {
  try {
    const raw = localStorage.getItem(POS_KEY + spot.id);
    if (raw) {
      const p = JSON.parse(raw) as { lat?: unknown; lon?: unknown };
      if (
        typeof p.lat === "number" &&
        typeof p.lon === "number" &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        Math.abs(p.lat) <= 90 &&
        Math.abs(p.lon) <= 180
      ) {
        return { lat: p.lat, lon: p.lon };
      }
    }
  } catch {
    // ugyldig værdi i lageret → configværdien
  }
  return { lat: spot.lat, lon: spot.lon };
}

// Appens egne værdier — det "Appens værdi" i tjek-panelet sætter tilbage til.
export function configGeometry(spot: Spot): SpotGeometry {
  return { lat: spot.lat, lon: spot.lon, normal: spot.shoreNormal };
}

// Er sted eller retning rettet i forhold til appens værdier?
export function isOverridden(spot: Spot): boolean {
  const g = effectiveGeometry(spot);
  return g.lat !== spot.lat || g.lon !== spot.lon || g.normal !== spot.shoreNormal;
}

// Sted og retning samlet — det kortet tegner efter.
export interface SpotGeometry {
  lat: number;
  lon: number;
  normal: number;
}

export function effectiveGeometry(spot: Spot): SpotGeometry {
  return { ...effectivePosition(spot), normal: effectiveNormal(spot) };
}

// "Tjek på kortet": brugeren har set spottet på kortet og bekræftet sted og
// retning (flyttet eller ej). Gemmer begge dele og hvornår, så NU-skærmen
// kan skifte fra "et gæt" til "bekræftet".
export function confirmOnMap(spot: Spot, geo: SpotGeometry): void {
  localStorage.setItem(POS_KEY + spot.id, JSON.stringify({ lat: geo.lat, lon: geo.lon }));
  setNormal(spot, geo.normal);
  localStorage.setItem(CHECKED_KEY + spot.id, new Date().toISOString());
}

// ISO-tidspunkt for bekræftelsen, eller null hvis spottet aldrig er tjekket.
export function checkedOnMapAt(spot: Spot): string | null {
  const v = localStorage.getItem(CHECKED_KEY + spot.id);
  return v !== null && !Number.isNaN(Date.parse(v)) ? v : null;
}
