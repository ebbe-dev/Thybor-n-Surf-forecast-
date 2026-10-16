// Målingerne holdt op mod forecasten — rene regler uden IO og uden ur.
//
// Bøjen ved Fjaltring ligger ud for Høfde Q på 17,5 m vand, nærmest det
// sydlige bølgepunkt (Bovbjerg/Thorsminde, AREAS i config/spots.ts).
// Vandstanden måles ved Thyborøn Kyst, i det nordlige område. En måling
// hører derfor til ÉT område, og "modellen mod bøjen" sammenligner bøjen
// med det sydlige områdes rækker — ikke med Thyborøn, 20 km nordligere,
// hvor molen skygger.
//
// Målingerne ændrer aldrig scoren. De står ved siden af, så man kan se, om
// modellen ligger over eller under havet lige nu — og over de sidste to
// døgn.

import type { Obs, BuoyRow, LevelRow } from "../api/obs";
import type { Row } from "../model/model";
import { fmt, fmtLevel, compass } from "./format";

export const BUOY_AREA = "thorsminde";
export const LEVEL_AREA = "thyboroen";

export const BUOY_MATCH_MIN = 45; // bøjen måler hver halve time
export const LEVEL_MATCH_MIN = 20; // vandstanden hvert 10. minut
export const STALE_MIN = 180; // ældre end 3 timer: målingen er gammel
export const CHECK_HOURS = 48; // modellen mod bøjen over de sidste to døgn

// Forecastens tider er lokale ISO-strenge uden zone ("2026-10-16T14:00",
// Europe/Copenhagen); telefonen læser dem i sin egen zone — samme
// antagelse som resten af appen (lib/time.ts). Målingerne er ISO UTC.
export const epochOf = (iso: string): number => new Date(iso).getTime();

export function latestBuoy(obs: Obs | null): BuoyRow | null {
  const rows = obs?.buoy?.rows;
  return rows && rows.length > 0 ? rows[rows.length - 1] : null;
}

export function latestLevel(obs: Obs | null): LevelRow | null {
  const rows = obs?.level?.rows;
  return rows && rows.length > 0 ? rows[rows.length - 1] : null;
}

// Rækken nærmest et tidspunkt, højst maxMin minutter fra; ved lige afstand
// den tidligste.
export function nearest<T extends { time: string }>(
  rows: T[] | undefined,
  epoch: number,
  maxMin: number
): T | null {
  if (!rows || rows.length === 0 || !Number.isFinite(epoch)) return null;
  let best: T | null = null;
  let bestDiff = maxMin * 60_000 + 1;
  for (const r of rows) {
    const diff = Math.abs(epochOf(r.time) - epoch);
    if (diff < bestDiff) {
      best = r;
      bestDiff = diff;
    }
  }
  return best;
}

export function buoyAt(obs: Obs | null, localIso: string): BuoyRow | null {
  return nearest(obs?.buoy?.rows, epochOf(localIso), BUOY_MATCH_MIN);
}

export function levelAt(obs: Obs | null, localIso: string): LevelRow | null {
  return nearest(obs?.level?.rows, epochOf(localIso), LEVEL_MATCH_MIN);
}

// Målingen til et tidspunkt på kortet. Er tidspunktet passeret, den
// nærmeste måling inden for vinduet. Er det nu eller den næste time (kortet
// åbner på den næste hele time), den seneste måling — det er "målt nu" —
// så længe den ikke er gammel. Længere fremme findes ingen måling.
export const NOW_SLACK_MIN = 60;

function forTime<T extends { time: string }>(
  rows: T[] | undefined,
  localIso: string,
  now: number,
  matchMin: number
): T | null {
  const t = epochOf(localIso);
  if (!Number.isFinite(t) || t > now + NOW_SLACK_MIN * 60_000) return null;
  const exact = nearest(rows, t, matchMin);
  if (exact) return exact;
  if (t < now - NOW_SLACK_MIN * 60_000 || !rows || rows.length === 0) return null;
  const latest = rows[rows.length - 1];
  return ageMin(latest.time, now) <= STALE_MIN ? latest : null;
}

export function buoyFor(obs: Obs | null, localIso: string, now: number): BuoyRow | null {
  return forTime(obs?.buoy?.rows, localIso, now, BUOY_MATCH_MIN);
}

export function levelFor(obs: Obs | null, localIso: string, now: number): LevelRow | null {
  return forTime(obs?.level?.rows, localIso, now, LEVEL_MATCH_MIN);
}

export function ageMin(isoUtc: string, now: number): number {
  return Math.round((now - epochOf(isoUtc)) / 60_000);
}

// "kl. 14:30" i telefonens tid; med dag, når målingen ikke er fra i dag.
export function fmtObsClock(isoUtc: string, now = new Date()): string {
  const d = new Date(isoUtc);
  const p = (n: number) => String(n).padStart(2, "0");
  const clock = `kl. ${p(d.getHours())}:${p(d.getMinutes())}`;
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return sameDay ? clock : `${d.getDate()}/${d.getMonth() + 1} ${clock}`;
}

// Bøjens periode: T_s, når den findes (≈ topperioden, som appen bruger);
// ellers middelperioden T_z, som ligger 20-30 % under — derfor står der
// "middel" ved den, og den får aldrig ground swell-mærket.
export function buoyPeriod(b: BuoyRow): { s: number; kind: "top" | "middel" } | null {
  // et nul er en pladsholder i Kystdirektoratets fil, ikke en periode
  if (b.tp != null && b.tp > 0) return { s: b.tp, kind: "top" };
  if (b.tz != null && b.tz > 0) return { s: b.tz, kind: "middel" };
  return null;
}

// Bøjens tal i ord: "1,8 m / 5,0 s middel · VSV".
export function fmtBuoy(b: BuoyRow): string {
  const per = buoyPeriod(b);
  let s = `${fmt(b.hs)} m`;
  if (per) s += ` / ${fmt(per.s)} s${per.kind === "middel" ? " middel" : ""}`;
  if (b.dir != null) s += ` · ${compass(b.dir)}`;
  return s;
}

export interface BuoyCheck {
  n: number; // bøje-målinger med en forecast-time inden for en halv time
  hours: number;
  hsBias: number; // forecast − bøje, m (positiv = modellen for høj)
  hsMae: number; // gennemsnitlig afvigelse uanset fortegn, m
  hsMaxMeasured: number; // bøjens største H_M0 i vinduet
  hsMaxForecast: number; // modellens største højde i de samme timer
}

// Modellen mod bøjen over de sidste `hours` timer: hver måling parres med
// forecastens nærmeste hele time (højst 30 min fra), og KUN på højden.
// Begge er signifikant bølgehøjde, så det er samme størrelse. Perioden
// sammenlignes ikke: bøjen giver middelperioden T_z, appen topperioden —
// to forskellige tal, og en forskel mellem dem ville ligne en modelfejl.
// Færre end tre par → intet tal; et gennemsnit af to målinger ligner et
// resultat og er det ikke.
export function checkForecast(
  rows: Row[],
  buoy: BuoyRow[] | undefined,
  now: number,
  hours = CHECK_HOURS
): BuoyCheck | null {
  if (!buoy || rows.length === 0) return null;
  const from = now - hours * 3600_000;
  const diffs: number[] = [];
  let maxM = 0;
  let maxF = 0;
  for (const b of buoy) {
    const t = epochOf(b.time);
    if (t < from || t > now) continue;
    const r = nearest(rows, t, 30);
    if (!r) continue;
    diffs.push(r.hs - b.hs);
    maxM = Math.max(maxM, b.hs);
    maxF = Math.max(maxF, r.hs);
  }
  if (diffs.length < 3) return null;
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  return {
    n: diffs.length,
    hours,
    hsBias: mean(diffs),
    hsMae: mean(diffs.map(Math.abs)),
    hsMaxMeasured: maxM,
    hsMaxForecast: maxF
  };
}

// Fortegnet bøjen læser: "+0,3 m" = modellen ligger over bøjen.
const signed = (v: number, unit: string, digits = 1) =>
  (v < 0 ? "−" : "+") + fmt(Math.abs(v), digits) + " " + unit;

// "+0,3 m i snit, spredning 0,4 m (90 målinger, 48 t)"
export function describeCheck(c: BuoyCheck): string {
  return `${signed(c.hsBias, "m")} i snit, spredning ${fmt(c.hsMae)} m (${c.n} målinger, ${c.hours} t)`;
}

// Ét ord om, hvor modellen ligger — til kortet og listen.
export function checkVerdict(c: BuoyCheck): "over" | "under" | "tæt på" {
  if (c.hsBias > 0.2) return "over";
  if (c.hsBias < -0.2) return "under";
  return "tæt på";
}

export { fmtLevel };
