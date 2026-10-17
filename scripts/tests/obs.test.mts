// Målingerne mod forecasten (src/lib/obs.ts): vinduer, "gammel", nu-slæk,
// bøjens periode og modellen mod bøjen. Tidszone: Europe/Copenhagen (run.mjs).
import {
  nearest,
  buoyAt,
  levelAt,
  buoyFor,
  levelFor,
  ageMin,
  buoyPeriod,
  fmtBuoy,
  checkForecast,
  describeCheck,
  checkVerdict,
  fmtObsClock
} from "../../src/lib/obs";
import type { Obs, BuoyRow } from "../../src/api/obs";
import type { Row } from "../../src/model/model";
import { check, near, done } from "./lib.mts";

const b = (iso: string, hs: number, extra: Partial<BuoyRow> = {}): BuoyRow => ({
  time: iso,
  hs,
  tp: null,
  tz: 5,
  hmax: null,
  tmax: null,
  dir: 260,
  ...extra
});
const obs: Obs = {
  fetchedAt: "2026-10-17T11:05:00.000Z",
  hours: 48,
  buoy: {
    ident: "2035",
    name: "Fjaltring",
    source: "",
    header: "",
    period: "T_z",
    rows: [b("2026-10-17T08:00:00.000Z", 1.0), b("2026-10-17T09:00:00.000Z", 1.0), b("2026-10-17T10:00:00.000Z", 1.0), b("2026-10-17T11:00:00.000Z", 1.0)]
  },
  level: {
    stationId: "9004203",
    name: "Thyborøn Kyst",
    parameter: "sea_reg",
    rows: [
      { time: "2026-10-17T09:50:00.000Z", m: 0.1 },
      { time: "2026-10-17T10:00:00.000Z", m: 0.2 },
      { time: "2026-10-17T10:10:00.000Z", m: 0.3 }
    ]
  },
  errors: []
};
// Dansk sommertid 17/10: lokal 12:00 = 10:00Z.
console.log("vinduer");
check("bøje ±45 min: kl. 12 lokalt → 10:00Z", buoyAt(obs, "2026-10-17T12:00")?.time === "2026-10-17T10:00:00.000Z");
check("bøje: 60 min væk er uden for vinduet", buoyAt(obs, "2026-10-17T14:00") === null);
check("vandstand ±20 min: kl. 12 lokalt → 10:00Z", levelAt(obs, "2026-10-17T12:00")?.m === 0.2);
check("vandstand: 30 min væk er uden for vinduet", levelAt(obs, "2026-10-17T12:40") === null);
check("nearest: ved lige afstand vinder den tidligste", nearest(obs.buoy!.rows, Date.parse("2026-10-17T09:30:00Z"), 45)?.time === "2026-10-17T09:00:00.000Z");
check("nearest: tom liste → null", nearest([], 0, 45) === null);

console.log("på kortet: nu og den næste time får den seneste måling");
const now = Date.parse("2026-10-17T12:10:00Z"); // 14:10 lokalt
check("passeret tidspunkt med måling: nærmeste", buoyFor(obs, "2026-10-17T12:00", now)?.time === "2026-10-17T10:00:00.000Z");
check("næste hele time uden måling: den seneste (70 min gammel)", buoyFor(obs, "2026-10-17T14:00", now)?.time === "2026-10-17T11:00:00.000Z");
check("to timer frem: ingen måling", buoyFor(obs, "2026-10-17T16:00", now) === null);
const later = Date.parse("2026-10-17T15:00:00Z");
check("seneste måling over 3 t gammel: ingen", buoyFor(obs, "2026-10-17T17:00", later) === null);
check("vandstand: samme regel", levelFor(obs, "2026-10-17T14:00", now)?.m === 0.3);
check("ageMin: 70 min", ageMin("2026-10-17T11:00:00.000Z", now) === 70);
check("klokkeslæt i dansk tid: 10:00Z → kl. 12:00", fmtObsClock("2026-10-17T10:00:00.000Z", new Date(now)) === "kl. 12:00");
check("klokkeslæt en anden dag får dato", fmtObsClock("2026-10-16T10:00:00.000Z", new Date(now)) === "16/10 kl. 12:00");

console.log("bøjens periode");
check("T_s = 0 er en pladsholder → middelperioden", buoyPeriod(b("x", 1, { tp: 0, tz: 4.8 }))?.kind === "middel");
check("T_s findes → topperioden", buoyPeriod(b("x", 1, { tp: 6.1 }))?.kind === "top");
check("ingen periode → null", buoyPeriod(b("x", 1, { tp: null, tz: null })) === null);
check("fmtBuoy: '1,9 m / 5,0 s middel · VSV'", fmtBuoy(b("x", 1.85, { tz: 5.04, dir: 250 })) === "1,9 m / 5,0 s middel · VSV");

console.log("modellen mod bøjen (kun højden)");
const frow = (iso: string, hs: number): Row => ({ time: iso, hs, tp: 6, swdir: 280, swell: null, windSea: null, level: null, wdir: 100, wspd: 3, gust: 4, temp: 10 });
const rows = [frow("2026-10-17T10:00", 1.2), frow("2026-10-17T11:00", 1.2), frow("2026-10-17T12:00", 1.2), frow("2026-10-17T13:00", 1.2)];
const c = checkForecast(rows, obs.buoy!.rows, Date.parse("2026-10-17T11:30:00Z"));
check("fire par", c?.n === 4, String(c?.n));
check("bias +0,2 m (model over bøjen)", c != null && near(c.hsBias, 0.2, 1e-9));
check("spredning 0,2 m", c != null && near(c.hsMae, 0.2, 1e-9));
check("beskrivelse", c != null && describeCheck(c) === "+0,2 m i snit, spredning 0,2 m (4 målinger, 48 t)", c ? describeCheck(c) : "");
check("+0,2 er 'tæt på', +0,3 er 'over'", c != null && checkVerdict(c) === "tæt på" && checkVerdict({ ...c, hsBias: 0.3 }) === "over");
check("under −0,2 er 'under'", c != null && checkVerdict({ ...c, hsBias: -0.25 }) === "under");
check("færre end tre par → intet tal", checkForecast(rows.slice(0, 2), obs.buoy!.rows, Date.parse("2026-10-17T11:30:00Z")) === null);
check("målinger uden forecast-time tæller ikke", checkForecast([frow("2026-10-17T10:00", 1.2)], obs.buoy!.rows, Date.parse("2026-10-17T11:30:00Z")) === null);

done("obs");
