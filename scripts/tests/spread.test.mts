// Modelspredningen: api/openMeteo.ts (spreadByTime, mergeHourly) og
// lib/spread.ts (det, der vises).
import { spreadByTime, mergeHourly, type MarineHourly, type WindHourly } from "../../src/api/openMeteo";
import { spreadOf, fmtHsWithSpread, fmtRange, fmtPm, SPREAD_UNSURE_M } from "../../src/lib/spread";
import { check, near, done } from "./lib.mts";

console.log("spreadByTime: nøgler wave_height_<model>, nul-modeller tæller ikke");
const h = {
  time: ["2026-10-17T12:00", "2026-10-17T13:00", "2026-10-17T14:00"],
  wave_height_marine_best_match: [1.5, 1.5, 1.5],
  wave_height_ewam: [1.9, null, null],
  wave_height_gwam: [1.1, 1.4, null],
  wave_height_ecmwf_wam025: [null, null, null]
};
const sp = spreadByTime(h);
const a = sp.get("2026-10-17T12:00");
check("tre modeller: lo 1,1 · hi 1,9 · n 3", a?.lo === 1.1 && a?.hi === 1.9 && a?.n === 3, JSON.stringify(a));
const b = sp.get("2026-10-17T13:00");
check("to modeller: n 2", b?.n === 2 && b.lo === 1.4 && b.hi === 1.5, JSON.stringify(b));
check("én model alene er ikke et spænd", sp.get("2026-10-17T14:00") === undefined);
check("intet svar → tomt", spreadByTime(null).size === 0 && spreadByTime(undefined).size === 0);

console.log("mergeHourly bærer spændet på rækken");
const m: MarineHourly = {
  time: ["2026-10-17T12:00", "2026-10-17T13:00"],
  wave_height: [1.5, 1.5],
  wave_direction: [300, 300],
  wave_period: [7, 7],
  swell_wave_height: [0.6, 0.6],
  swell_wave_period: [10, 10],
  swell_wave_direction: [310, 310],
  swell_wave_peak_period: [14, 14]
};
const w: WindHourly = {
  time: ["2026-10-17T12:00", "2026-10-17T13:00"],
  wind_speed_10m: [4, 4],
  wind_direction_10m: [110, 110],
  wind_gusts_10m: [6, 6],
  temperature_2m: [11, 11]
};
const merged = mergeHourly(m, w, null, sp);
check("12:00 har spændet", merged.rows[0].hsSpread?.n === 3);
check("13:00 har spændet", merged.rows[1].hsSpread?.n === 2);
check("uden spænd-kald: null", mergeHourly(m, w).rows[0].hsSpread === null);

console.log("lib/spread: det, der vises");
const r = { hs: 1.5, hsSpread: { lo: 1.1, hi: 1.9, n: 4 } };
const s = spreadOf(r)!;
check("±0,4 ved 1,1–1,9", near(s.pm, 0.4, 1e-9) && fmtPm(s) === "±0,4", fmtPm(s));
check("usikker over 0,3 m", s.unsure === true && SPREAD_UNSURE_M === 0.3);
check("'1,5 ±0,4 m'", fmtHsWithSpread(r) === "1,5 ±0,4 m", fmtHsWithSpread(r));
check("'1,1–1,9 m'", fmtRange(s) === "1,1–1,9 m", fmtRange(s));
const tight = { hs: 1.5, hsSpread: { lo: 1.4, hi: 1.6, n: 5 } };
check("enige (0,2 m): tallet alene", fmtHsWithSpread(tight) === "1,5 m" && spreadOf(tight)?.unsure === false);
check("præcis 0,3 m er ikke usikker", spreadOf({ hs: 1.5, hsSpread: { lo: 1.35, hi: 1.65, n: 3 } })?.unsure === false);
check("appens eget tal hører med i spændet", spreadOf({ hs: 2.0, hsSpread: { lo: 1.1, hi: 1.5, n: 2 } })?.hi === 2.0);
check("uden spænd → null", spreadOf({ hs: 1.5, hsSpread: null }) === null && spreadOf({ hs: 1.5 }) === null);
check("én model → null", spreadOf({ hs: 1.5, hsSpread: { lo: 1.5, hi: 1.5, n: 1 } }) === null);

done("spread");
