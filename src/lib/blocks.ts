// Bygger 3-timers blokke pr. dag pr. spot og finder dommen
// (bedste kommende blok på tværs af spots).

import type { CachedForecast } from "./storage";
import { scoreSpot, moleSide, type Row } from "../model/model";
import { effectiveNormal, type Spot } from "../config/spots";
import { BLOCK_HOURS, dateOf, hourOf } from "./time";
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

export function buildDays(f: CachedForecast, spot: Spot): Day[] {
  const ar = f.areas[spot.area];
  if (!ar || ar.dry) return [];
  const normal = effectiveNormal(spot);
  const byTime = new Map(ar.rows.map((r) => [r.time, r]));
  const dates = [...new Set(ar.rows.map((r) => dateOf(r.time)))].sort();
  return dates.map((date) => ({
    date,
    blocks: BLOCK_HOURS.map((h) => {
      const t = `${date}T${String(h).padStart(2, "0")}:00`;
      const row = byTime.get(t);
      if (!row) return null;
      return {
        time: t,
        row,
        // personlig korrektion fra loggede sessions oveni (lib/calibration.ts)
        score: adjustedScore(
          scoreSpot(row, normal, { offshore: spot.offshoreDir, fixedSide: spot.fixedSide }),
          spot.id
        ),
        // enkeltsidede spots viser altid deres side; ellers vind-læsiden
        side: spot.fixedSide ?? moleSide(row.wdir)
      };
    })
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

// Bedste kommende blok i dagslys. Ved lighed vinder den tidligste
// (og rækkefølgen i SPOTS).
export function pickVerdict(f: CachedForecast, spots: Spot[]): VerdictPick | null {
  const now = nowLocalIso();
  let best: VerdictPick | null = null;
  for (const spot of spots) {
    for (const day of buildDays(f, spot)) {
      for (const b of day.blocks) {
        if (!b || b.time < now) continue;
        if (!isDaylightBlock(b.time, spot)) continue;
        if (!best || b.score > best.block.score) best = { spot, block: b };
      }
    }
  }
  return best;
}
