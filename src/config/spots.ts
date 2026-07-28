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
}

// Gridpunkter til Open-Meteo. Verificeret i produktion 28/07/2026:
// bølgepunktet er en våd gridcelle (returnerer swell-data). Flyttes punktet,
// og det rammer land, svarer API'et kun null og appen viser en fejl.
export const WAVE_POINT = { lat: 56.66, lon: 8.13 };
export const WIND_POINT = { lat: 56.68, lon: 8.2 };

export const SPOTS: Spot[] = [
  {
    id: "vestkysten",
    name: "Vestkysten — høfderækken (Langerhuse / Rønlanger)",
    shortName: "Vestkysten",
    shoreNormal: 275,
    lat: 56.6605,
    lon: 8.1695
  },
  {
    id: "indsejlingen",
    name: "Den gamle færgeindsejling (øst for Thyborøn)",
    shortName: "Indsejlingen",
    shoreNormal: 300, // DEFAULT-GÆT. Mundingens retning er ikke kalibreret.
    lat: 56.7005,
    lon: 8.2255,
    adjustableNormal: true,
    uncalibrated: true,
    warning:
      "Strømmen i Thyborøn Kanal forudsiges ikke af nogen model, og den kan " +
      "være livsfarlig. Vurdér den selv på stedet, hver gang."
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
