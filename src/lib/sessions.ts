// Session-loggen. Lokal-først: localStorage er sandheden, og CSV/JSON-
// eksport er brugerens backup (Sheets-backenden blev fravalgt — nemmest
// muligt var kravet). CSV-kolonnerne følger den oprindelige spec-rækkefølge,
// så filen kan pivoteres direkte i et regneark.

import type { Row } from "../model/model";
import { scoreSpot } from "../model/model";
import { effectiveNormal, SPOTS, type Spot } from "../config/spots";
import { loadForecast } from "./storage";
import { loadCachedHistory } from "../api/archive";
import { dateOf } from "./time";

export interface Session {
  id: string;
  time: string; // ISO lokal, fx 2026-07-28T17:00
  spotId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  note: string;
  // Snapshot af de forhold modellen forudsagde — null hvis ingen data fandtes
  // for tidspunktet. Vi digter aldrig et snapshot.
  snapshot: {
    hs: number;
    tp: number;
    swdir: number;
    wspd: number;
    wdir: number;
    gust: number;
  } | null;
  predicted: number | null; // modellens score på tidspunktet
}

export const SESSIONS_KEY = "bygtangen.sessions";
const KEY = SESSIONS_KEY;

export function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as Session[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSessions(list: Session[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

// Nærmeste kendte time (±2 t) i spottets vejr-område, fra forecast-
// eller historik-cachen.
export function findRowAt(timeIso: string, areaId: string): Row | null {
  const candidates: Row[] = [
    ...(loadForecast()?.areas[areaId]?.rows ?? []),
    ...(loadCachedHistory()?.areas[areaId]?.rows ?? [])
  ];
  let best: Row | null = null;
  let bestDist = Infinity;
  const target = new Date(timeIso).getTime();
  for (const r of candidates) {
    const dist = Math.abs(new Date(r.time).getTime() - target);
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return bestDist <= 2 * 3600_000 ? best : null;
}

export function createSession(
  timeIso: string,
  spot: Spot,
  rating: Session["rating"],
  note: string
): Session {
  const row = findRowAt(timeIso, spot.area);
  return {
    id: String(Date.now()) + Math.random().toString(36).slice(2, 7),
    time: timeIso,
    spotId: spot.id,
    rating,
    note,
    snapshot: row
      ? { hs: row.hs, tp: row.tp, swdir: row.swdir, wspd: row.wspd, wdir: row.wdir, gust: row.gust }
      : null,
    // ALTID modellens rå score — aldrig den justerede. Ellers ville
    // kalibreringen (lib/calibration.ts) fodre sig selv.
    predicted: row ? scoreSpot(row, effectiveNormal(spot), spot.offshoreDir) : null
  };
}

// Løbende gennemsnit af (karakter × 2 − modellens score).
export function meanDeviation(list: Session[]): { mean: number; n: number } | null {
  const scored = list.filter((s) => s.predicted !== null);
  if (scored.length === 0) return null;
  const sum = scored.reduce((acc, s) => acc + (s.rating * 2 - (s.predicted as number)), 0);
  return { mean: sum / scored.length, n: scored.length };
}

export function sessionsOnDate(list: Session[], date: string): Session[] {
  return list.filter((s) => dateOf(s.time) === date);
}

// CSV med præcis spec'ens kolonner og rækkefølge.
export function toCsv(list: Session[]): string {
  const header =
    "timestamp,spot,rating,note,hs,tp,swell_dir,wind_spd,wind_dir,gust,predicted_score";
  const esc = (s: string) => '"' + s.replaceAll('"', '""') + '"';
  const lines = list.map((s) => {
    const spot = SPOTS.find((x) => x.id === s.spotId)?.shortName ?? s.spotId;
    const snap = s.snapshot;
    return [
      s.time,
      spot,
      s.rating,
      esc(s.note),
      snap?.hs ?? "",
      snap?.tp ?? "",
      snap?.swdir ?? "",
      snap?.wspd ?? "",
      snap?.wdir ?? "",
      snap?.gust ?? "",
      s.predicted?.toFixed(2) ?? ""
    ].join(",");
  });
  return [header, ...lines].join("\n");
}

export function download(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
