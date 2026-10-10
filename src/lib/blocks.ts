// Bygger 3-timers blokke pr. dag pr. spot og rangerer spots efter deres
// bedste kommende blok inden for forsidens horisont (i dag + i morgen).
// Dommen er toppen af den rangering — aldrig noget listen ikke viser.

import type { CachedForecast } from "./storage";
import { scoreSpot, moleSide, type Row } from "../model/model";
import { effectiveNormal, type Spot } from "../config/spots";
import { BLOCK_HOURS, dateOf, hourOf, nextDate } from "./time";
import { adjustedScore } from "./calibration";
import { sunTimes, daylightOverlap } from "./sun";

export interface Block {
  time: string;
  row: Row;
  score: number;
  side: "nord" | "syd";
}

export interface Day {
  date: string;
  blocks: (Block | null)[]; // null = hul i data
}

// Alle timer scoret for ét spot — kortets skyder kører time for time.
export function hourlyBlocks(f: CachedForecast, spot: Spot): Map<string, Block> {
  const m = new Map<string, Block>();
  const ar = f.areas[spot.area];
  if (!ar || ar.dry) return m;
  const normal = effectiveNormal(spot);
  for (const row of ar.rows) {
    m.set(row.time, {
      time: row.time,
      row,
      // personlig korrektion fra loggede sessions oveni (lib/calibration.ts)
      score: adjustedScore(
        scoreSpot(row, normal, { offshore: spot.offshoreDir, fixedSide: spot.fixedSide }),
        spot.id
      ),
      // enkeltsidede spots viser altid deres side; ellers vind-læsiden
      side: spot.fixedSide ?? moleSide(row.wdir)
    });
  }
  return m;
}

// Barografens 3-timers blokke (05–20) — udpluk af timescorerne.
export function buildDays(f: CachedForecast, spot: Spot): Day[] {
  const ar = f.areas[spot.area];
  if (!ar || ar.dry) return [];
  const byTime = hourlyBlocks(f, spot);
  const dates = [...new Set(ar.rows.map((r) => dateOf(r.time)))].sort();
  return dates.map((date) => ({
    date,
    blocks: BLOCK_HOURS.map(
      (h) => byTime.get(`${date}T${String(h).padStart(2, "0")}:00`) ?? null
    )
  }));
}

export interface VerdictPick {
  spot: Spot;
  block: Block;
}

export function nowLocalIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Mindst én times dagslys i blokken — ellers anbefaler vi den ikke.
// (Barografen viser stadig alle blokke; kun anbefalinger filtreres.)
export function isDaylightBlock(time: string, spot: Spot): boolean {
  const st = sunTimes(dateOf(time), spot.lat, spot.lon);
  return daylightOverlap(hourOf(time), st) >= 1;
}

// Forsidens horisont: "næste 2 døgn" (resten af i dag + hele i morgen)
// eller "næste 7 dage" — brugerens valg (lib/settings.ts). Listen, dommen
// og kortenes grafer deler den, så dommen aldrig peger længere frem end
// listen. Standard er 2 døgn: dér er "torsdag kl. 14" aldrig et svar om
// søndagen, medmindre man selv har bedt om ugen.
export const HORIZON_OPTIONS = [2, 7] as const;
export type HorizonDays = (typeof HORIZON_OPTIONS)[number];
export const DEFAULT_HORIZON: HorizonDays = 2;

export function horizonDates(now: string, days: number = DEFAULT_HORIZON): string[] {
  const dates = [dateOf(now)];
  while (dates.length < days) dates.push(nextDate(dates[dates.length - 1]));
  return dates;
}

// Bedste kommende dagslys-blok for ét spot inden for horisonten.
// Ved lighed vinder den tidligste.
function bestBlock(f: CachedForecast, spot: Spot, now: string, days: number): Block | null {
  const dates = horizonDates(now, days);
  let best: Block | null = null;
  for (const day of buildDays(f, spot)) {
    if (!dates.includes(day.date)) continue;
    for (const b of day.blocks) {
      if (!b || b.time < now) continue;
      if (!isDaylightBlock(b.time, spot)) continue;
      if (!best || b.score > best.score) best = b;
    }
  }
  return best;
}

// Alle spots med deres bedste blok, bedste først. Spots uden en brugbar
// blok udelades. Ved lighed vinder rækkefølgen i `spots` (sort er stabil).
export function rankSpots(
  f: CachedForecast,
  spots: Spot[],
  now = nowLocalIso(),
  days: number = DEFAULT_HORIZON
): VerdictPick[] {
  const picks: VerdictPick[] = [];
  for (const spot of spots) {
    const block = bestBlock(f, spot, now, days);
    if (block) picks.push({ spot, block });
  }
  return picks.sort((a, b) => b.block.score - a.block.score);
}

// Dommen: listens øverste række.
export function pickVerdict(
  f: CachedForecast,
  spots: Spot[],
  days: number = DEFAULT_HORIZON
): VerdictPick | null {
  return rankSpots(f, spots, nowLocalIso(), days)[0] ?? null;
}
