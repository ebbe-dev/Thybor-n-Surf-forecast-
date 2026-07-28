// Historik: marine-arkivet + ERA5-vindarkivet for et datointerval, plus en
// "hale" fra forecast-endpoints med past_days — arkiverne hænger typisk
// nogle dage efter nutiden, og halen dækker det stykke ærligt i stedet for
// at efterlade et hul, der ligner en fejl.
//
// Rækkevidde: hvor langt marine-arkivet reelt rækker, afgøres af svaret —
// UI'et viser første dato med data og lader resten stå tomt. Ingen udfyldning.

import type { Row } from "../model/model";
import {
  MARINE_BASE,
  WIND_BASE,
  WIND_HOURLY,
  getJson,
  mergeHourly,
  type MarineHourly,
  type WindHourly
} from "./openMeteo";
import { WIND_POINT } from "../config/spots";
import { dateOf } from "../lib/time";

const ARCHIVE_WIND_BASE =
  "https://archive-api.open-meteo.com/v1/archive" +
  `?latitude=${WIND_POINT.lat}&longitude=${WIND_POINT.lon}` +
  `&hourly=${WIND_HOURLY}&wind_speed_unit=ms&timezone=Europe%2FCopenhagen`;

export interface HistoryData {
  fetchedAt: string; // ISO
  start: string; // YYYY-MM-DD
  end: string;
  rows: Row[];
  holes: string[];
}

const KEY = "bygtangen.history";

export function loadCachedHistory(): HistoryData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as HistoryData;
    if (!Array.isArray(h.rows)) return null;
    return h;
  } catch {
    return null;
  }
}

function saveCachedHistory(h: HistoryData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // 12 måneders timedata kan overskride kvoten — så henter vi bare igen næste gang
  }
}

// Dækker cachen intervallet, og er den hentet i dag, genbruges den.
export function usableCache(start: string, end: string): HistoryData | null {
  const c = loadCachedHistory();
  if (!c) return null;
  if (c.start > start || c.end < end) return null;
  if (dateOf(c.fetchedAt) !== dateOf(new Date().toISOString())) return null;
  return c;
}

export async function fetchHistory(start: string, end: string): Promise<HistoryData> {
  const cached = usableCache(start, end);
  if (cached) return cached;

  const marineUrl = `${MARINE_BASE}&start_date=${start}&end_date=${end}`;
  const windUrl = `${ARCHIVE_WIND_BASE}&start_date=${start}&end_date=${end}`;
  // Halen: seneste 7 døgn fra forecast-endpoints (arkivets efterslæb).
  const tailMarineUrl = `${MARINE_BASE}&past_days=7&forecast_days=1`;
  const tailWindUrl = `${WIND_BASE}&past_days=7&forecast_days=1`;

  const [marine, wind, tailMarine, tailWind] = await Promise.all([
    getJson<{ hourly: MarineHourly }>(marineUrl),
    getJson<{ hourly: WindHourly }>(windUrl),
    // Fejler halen, må de sidste dage stå som hul — det vælter ikke historikken.
    getJson<{ hourly: MarineHourly }>(tailMarineUrl).catch(() => null),
    getJson<{ hourly: WindHourly }>(tailWindUrl).catch(() => null)
  ]);

  const arch = mergeHourly(marine.hourly, wind.hourly);

  const byTime = new Map<string, Row>();
  for (const r of arch.rows) byTime.set(r.time, r);

  if (tailMarine && tailWind) {
    const tail = mergeHourly(tailMarine.hourly, tailWind.hourly);
    const today = dateOf(new Date().toISOString());
    for (const r of tail.rows) {
      const d = dateOf(r.time);
      if (d >= start && d <= end && d <= today && !byTime.has(r.time)) byTime.set(r.time, r);
    }
  }

  const rows = [...byTime.values()].sort((a, b) => (a.time < b.time ? -1 : 1));
  const holes = arch.holes.filter((t) => !byTime.has(t));

  const result: HistoryData = {
    fetchedAt: new Date().toISOString(),
    start,
    end,
    rows,
    holes
  };
  saveCachedHistory(result);
  return result;
}
