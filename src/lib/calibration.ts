// Personlig kalibrering: en korrektion oven på modellens score, lært af
// loggede sessions (karakter × 2 minus modellens RÅ score).
//
// Bevidst forsigtig:
// - Dæmpet ("shrinkage"): korrektion = sum(afvigelser) / (antal + SHRINK_K).
//   Få sessions flytter lidt, mange flytter mere. Med 2 sessions og et snit
//   på -2 bliver korrektionen kun ca. -0,5.
// - Aldrig mere end ±MAX_CORRECTION.
// - Spots med mindst MIN_SPOT_SESSIONS egne sessions får egen korrektion,
//   resten deler den fælles.
// - Session-snapshots gemmer ALTID modellens rå score (se sessions.ts),
//   så korrektionen aldrig fodrer sig selv.
//
// Konstanterne i model.ts røres ikke — det her er et lag ovenpå, og det
// kan slås fra med kontakten i LOG.

import type { Session } from "./sessions";
import { SESSIONS_KEY } from "./sessions";

export const SHRINK_K = 6; // prior-vægt: så mange "neutrale" sessions vejer imod
export const MAX_CORRECTION = 2;
export const MIN_SPOT_SESSIONS = 3;

const ENABLED_KEY = "bygtangen.calibration.enabled";

export function calibrationEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) !== "0";
}

export function setCalibrationEnabled(on: boolean): void {
  localStorage.setItem(ENABLED_KEY, on ? "1" : "0");
}

export interface CorrectionInfo {
  correction: number; // det der lægges til scoren (kan være 0)
  n: number; // sessions bag korrektionen
  basis: "spot" | "global" | "none";
}

interface CalcResult {
  perSpot: Map<string, CorrectionInfo>;
  global: CorrectionInfo;
}

// Genberegnes kun når sessions-strengen i localStorage har ændret sig.
let cachedRaw: string | null = null;
let cached: CalcResult | null = null;

const clamp = (v: number) =>
  Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, v));

function calc(): CalcResult {
  const raw = localStorage.getItem(SESSIONS_KEY) ?? "[]";
  if (raw === cachedRaw && cached) return cached;

  let list: Session[] = [];
  try {
    const parsed = JSON.parse(raw) as Session[];
    if (Array.isArray(parsed)) list = parsed;
  } catch {
    // ulæselig log → ingen korrektion
  }

  const scored = list.filter((s) => s.predicted !== null);
  const sumAll = scored.reduce((a, s) => a + (s.rating * 2 - (s.predicted as number)), 0);
  const global: CorrectionInfo =
    scored.length === 0
      ? { correction: 0, n: 0, basis: "none" }
      : { correction: clamp(sumAll / (scored.length + SHRINK_K)), n: scored.length, basis: "global" };

  const perSpot = new Map<string, CorrectionInfo>();
  const bySpot = new Map<string, Session[]>();
  for (const s of scored) {
    const arr = bySpot.get(s.spotId) ?? [];
    arr.push(s);
    bySpot.set(s.spotId, arr);
  }
  for (const [spotId, arr] of bySpot) {
    if (arr.length >= MIN_SPOT_SESSIONS) {
      const sum = arr.reduce((a, s) => a + (s.rating * 2 - (s.predicted as number)), 0);
      perSpot.set(spotId, {
        correction: clamp(sum / (arr.length + SHRINK_K)),
        n: arr.length,
        basis: "spot"
      });
    }
  }

  cachedRaw = raw;
  cached = { perSpot, global };
  return cached;
}

export function correctionFor(spotId: string): CorrectionInfo {
  if (!calibrationEnabled()) return { correction: 0, n: 0, basis: "none" };
  const { perSpot, global } = calc();
  return perSpot.get(spotId) ?? global;
}

// Justeret score: rå modelscore + personlig korrektion, klippet til 0..10.
export function adjustedScore(raw: number, spotId: string): number {
  const { correction } = correctionFor(spotId);
  return Math.max(0, Math.min(10, raw + correction));
}
