// Statistik over scoret historik for ét spot. Alt regnes fra rå Rows i
// én gennemgang — 12 måneders timer er ~9.000 rækker, det tager millisekunder.

import { scoreSpot, type Row } from "../model/model";
import { effectiveNormal, type Spot } from "../config/spots";
import { dateOf, hourOf } from "./time";
import { adjustedScore } from "./calibration";

export interface HourScore {
  time: string;
  score: number;
  row: Row;
}

export interface DayStat {
  date: string;
  max: number;
  bestTime: string;
  hours: HourScore[];
}

export interface HistoryStats {
  days: Map<string, DayStat>;
  firstDataDate: string | null; // første dato kilden reelt dækker
  // vindrose: timer med score > 5, talt pr. 16 kompas-sektorer (efter vindretning)
  rose: number[];
  roseTotal: number;
  // fordeling: timer pr. heltalsbin 0..9 (bin i = [i, i+1))
  bins: number[];
  // dage hvor dagens maks nåede over tærsklen
  daysOver: { threshold: number; days: number }[];
}

export const ROSE_THRESHOLD = 5;
const THRESHOLDS = [1.5, 3.5, 6, 8];

export function computeStats(rows: Row[], spot: Spot): HistoryStats {
  const normal = effectiveNormal(spot);
  const days = new Map<string, DayStat>();
  const rose = new Array(16).fill(0) as number[];
  const bins = new Array(10).fill(0) as number[];
  let roseTotal = 0;

  for (const row of rows) {
    const score = adjustedScore(scoreSpot(row, normal), spot.id);
    const date = dateOf(row.time);
    let day = days.get(date);
    if (!day) {
      day = { date, max: 0, bestTime: row.time, hours: [] };
      days.set(date, day);
    }
    day.hours.push({ time: row.time, score, row });
    if (score > day.max) {
      day.max = score;
      day.bestTime = row.time;
    }
    bins[Math.min(9, Math.floor(score))]++;
    if (score > ROSE_THRESHOLD) {
      rose[Math.round((((row.wdir % 360) + 360) % 360) / 22.5) % 16]++;
      roseTotal++;
    }
  }

  const daysOver = THRESHOLDS.map((threshold) => ({
    threshold,
    days: [...days.values()].filter((d) => d.max >= threshold).length
  }));

  const firstDataDate =
    rows.length > 0 ? dateOf(rows[0].time) : null;

  return { days, firstDataDate, rose, roseTotal, bins, daysOver };
}

// Dagens timer som 24 pladser (null = hul), til dags-timelinen.
export function hoursOfDay(day: DayStat): (HourScore | null)[] {
  const out: (HourScore | null)[] = new Array(24).fill(null);
  for (const h of day.hours) out[hourOf(h.time)] = h;
  return out;
}
