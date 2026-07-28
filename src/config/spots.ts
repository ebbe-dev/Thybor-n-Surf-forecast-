// Spots ned langs tangen. Tilføj en høfde ved at tilføje et objekt —
// hver høfde kan have sin egen kystnormal, de eksponeres forskelligt.

export interface Spot {
  id: string;
  name: string;
  shortName: string; // til dommen og knapper
  shoreNormal: number; // grader kysten vender imod
  lat: number;
  lon: number;
  // Orienteringen kan overstyres i UI'et (gemmes i localStorage).
  adjustableNormal?: boolean;
  uncalibrated?: boolean; // vis "ukalibreret" i UI'et
  warning?: string; // fast advarsel, vises altid på spottet
  // Tegn en høfderække på kortet: antal streger, afstand og længde i meter.
  groynes?: { count: number; spacingM: number; lengthM: number };
}

// Gridpunkter til Open-Meteo. Verificeret i produktion 28/07/2026:
// bølgepunktet er en våd gridcelle (returnerer swell-data). Flyttes punktet,
// og det rammer land, svarer API'et kun null og appen viser en fejl.
export const WAVE_POINT = { lat: 56.66, lon: 8.13 };
export const WIND_POINT = { lat: 56.68, lon: 8.2 };

const KANAL_WARNING =
  "Strømmen i Thyborøn Kanal forudsiges ikke af nogen model, og den kan " +
  "være livsfarlig. Vurdér den selv på stedet, hver gang.";

// Alle fem positioner er bekræftet af brugeren 28/07/2026 (Udkigsposten
// med præcis nål, resten visuelt på kortet). Kystnormalerne for de
// ukalibrerede spots justeres i appen. id'erne må ikke ændres
// (localStorage-nøgler).

export const SPOTS: Spot[] = [
  {
    // Historisk id "vestkysten" — brugerens tidlige sessions peger på det.
    id: "vestkysten",
    name: "Langerhuse Højre — høfden ved fiskemolen",
    shortName: "Langerhuse H",
    shoreNormal: 275, // kalibreret mod faktiske sessions
    lat: 56.6304935, // brugerens nål på fiskemolen, 28/07/2026
    lon: 8.1522159,
    groynes: { count: 3, spacingM: 250, lengthM: 130 }
  },
  {
    id: "langerhuse-venstre",
    name: "Langerhuse Venstre — høfden ved Flyvholm Redningsstation",
    shortName: "Langerhuse V",
    shoreNormal: 275, // samme kyststrækning, samme kalibrering
    lat: 56.6244138, // brugerens nål på Flyvholm Redningsstation, 28/07/2026
    lon: 8.1505821,
    groynes: { count: 3, spacingM: 250, lengthM: 130 }
  },
  {
    id: "udkigsposten",
    name: "Udkigsposten (mellem Langerhuse og Thyborøn)",
    shortName: "Udkigsposten",
    shoreNormal: 285, // skøn: kysten er begyndt at dreje mod NV her
    lat: 56.6926259, // brugerens nål, 28/07/2026
    lon: 8.1969374,
    groynes: { count: 5, spacingM: 250, lengthM: 130 }
  },
  {
    id: "sneglehuset",
    name: "Sneglehuset (NV-stranden ved Thyborøn by)",
    shortName: "Sneglehuset",
    shoreNormal: 300, // NV-vendt bue før kanalmundingen
    lat: 56.7005,
    lon: 8.2035,
    groynes: { count: 5, spacingM: 220, lengthM: 120 }
  },
  {
    id: "indsejlingen",
    name: "Indsejlingen (kanalmundingen)",
    shortName: "Indsejlingen",
    shoreNormal: 300, // DEFAULT-GÆT fra spec — ukalibreret
    lat: 56.7089371, // brugerens nål, 28/07/2026
    lon: 8.2171907,
    adjustableNormal: true,
    uncalibrated: true,
    warning: KANAL_WARNING
  },
  {
    id: "faergehavnen",
    name: "Den gamle færgehavn (øst for Thyborøn by)",
    shortName: "Færgehavnen",
    shoreNormal: 30, // DEFAULT-GÆT: lever af refrakteret energi ned gennem kanalen
    lat: 56.6903646, // brugerens nål, 28/07/2026
    lon: 8.2265966,
    adjustableNormal: true,
    uncalibrated: true,
    warning: KANAL_WARNING
  }
];

const NORMAL_KEY = "bygtangen.normal.";

// Effektiv kystnormal: brugerens indstilling hvis spottet er justerbart,
// ellers configværdien.
export function effectiveNormal(spot: Spot): number {
  if (spot.adjustableNormal) {
    const v = localStorage.getItem(NORMAL_KEY + spot.id);
    if (v !== null) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0 && n < 360) return n;
    }
  }
  return spot.shoreNormal;
}

export function setNormal(spot: Spot, deg: number): void {
  localStorage.setItem(NORMAL_KEY + spot.id, String(((deg % 360) + 360) % 360));
}
