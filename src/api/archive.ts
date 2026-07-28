// Historik pr. vejr-område: marine-arkivet + ERA5-vindarkivet for et
// datointerval, plus en "hale" fra forecast-endpoints med past_days —
// arkiverne hænger typisk nogle dage efter nutiden, og halen dækker det
// stykke ærligt i stedet for at efterlade et hul, der ligner en fejl.
//
// Rækkevidde: hvor langt marine-arkivet reelt rækker, afgøres af svaret —
// UI'et viser første dato med data og lader resten stå tomt. Ingen udfyldning.

import type { Row } from "../model/model";
import {
  MARINE_BASE,
  WIND_BASE,
  ARCHIVE_WIND_BASE,
  getJson,
  asArray,
  splitByArea,
  type MarineHourly,
  type WindHourly
} from "./openMeteo";
import { AREAS } from "../config/spots";
import { dateOf } from "../lib/time";

export interface AreaHistory {
  rows: Row[];
  holes: string[];
}

export interface HistoryData {
  fetchedAt: string; // ISO
  start: string; // YYYY-MM-DD
  end: string;
  areas: Record<string, AreaHistory>;
}

// v2: område-opdelt
const KEY = "bygtangen.history2";

export function loadCachedHistory(): HistoryData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const h = JSON.parse(raw) as HistoryData;
    if (!h.areas || typeof h.areas !== "object") return null;
    return h;
  } catch {
    return null;
  }
}

function saveCachedHistory(h: HistoryData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(h));
  } catch {
    // 12+ måneders timedata x flere områder kan overskride kvoten —
    // så henter vi bare igen næste gang
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

type MarineResp = { hourly: MarineHourly };
type WindResp = { hourly: WindHourly };

export async function fetchHistory(start: string, end: string): Promise<HistoryData> {
  const cached = usableCache(start, end);
  if (cached) return cached;

  const range = `&start_date=${start}&end_date=${end}`;
  // Halen: seneste 7 døgn fra forecast-endpoints (arkivets efterslæb).
  const [marineRes, windRes, tailMarineRes, tailWindRes] = await Promise.all([
    getJson<MarineResp | MarineResp[]>(MARINE_BASE + range),
    getJson<WindResp | WindResp[]>(ARCHIVE_WIND_BASE + range),
    getJson<MarineResp | MarineResp[]>(MARINE_BASE + "&past_days=7&forecast_days=1").catch(() => null),
    getJson<WindResp | WindResp[]>(WIND_BASE + "&past_days=7&forecast_days=1").catch(() => null)
  ]);

  const arch = splitByArea(asArray(marineRes), asArray(windRes));
  const tail =
    tailMarineRes && tailWindRes ? splitByArea(asArray(tailMarineRes), asArray(tailWindRes)) : null;

  const today = dateOf(new Date().toISOString());
  const areas: Record<string, AreaHistory> = {};

  for (const a of AREAS) {
    const base = arch[a.id] ?? { rows: [], holes: [], dry: true };
    const byTime = new Map<string, Row>();
    for (const r of base.rows) byTime.set(r.time, r);

    if (tail) {
      for (const r of tail[a.id]?.rows ?? []) {
        const d = dateOf(r.time);
        if (d >= start && d <= end && d <= today && !byTime.has(r.time)) byTime.set(r.time, r);
      }
    }

    const rows = [...byTime.values()].sort((x, y) => (x.time < y.time ? -1 : 1));
    areas[a.id] = { rows, holes: base.holes.filter((t) => !byTime.has(t)) };
  }

  const result: HistoryData = {
    fetchedAt: new Date().toISOString(),
    start,
    end,
    areas
  };
  saveCachedHistory(result);
  return result;
}
