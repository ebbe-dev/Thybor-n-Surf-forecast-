// Seedede data til browsertests og skærmbilleder: 14 døgns forecast for
// begge vejr-områder (localStorage bygtangen.forecast3) og 48 timers
// målinger (bygtangen.obs1). Uden net læser appen cachen og skriver
// "Offline". Scenariet følger sessionens referencedage, så læ, udblæsning
// og advarsler kan ses: i dag NV-dønning i let fralandsvind (26/7-ankeret),
// i morgen sydbølge langs tangen i sydvind 10 m/s (13/10), dagen efter
// vestenvind 12 m/s og høj vandstand (14/10), dagen efter igen hård
// fralandsvind og stor sø (11/10). Resten er stille baggrund.

const fmtLocal = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Copenhagen",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

// Et tidspunkt som appens lokale ISO-streng uden zone: "2026-10-17T08:00".
export const localIso = (d) => fmtLocal.format(d).replace(" ", "T");
const dateOf = (iso) => iso.slice(0, 10);
const addDays = (date, n) => {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const round = (v, k = 2) => Math.round(v * 10 ** k) / 10 ** k;

// Forholdene pr. dag-forskydning (0 = i dag) og lokal time.
export function conditions(dayOff, hh, areaId) {
  let hs;
  let tp;
  let swdir;
  let wdir;
  let wspd;
  let gust;
  let level = 0.1;
  if (dayOff === 0) {
    // NV ground swell med let fralandsvind, bedst midt på dagen
    const peak = 1 - Math.min(1, Math.abs(hh - 13) / 9);
    hs = 1.0 + 0.6 * peak;
    tp = 8.2 + 1.2 * peak;
    swdir = 300;
    wdir = 110;
    wspd = 3 + 2 * peak;
    gust = wspd + 2;
  } else if (dayOff === 1) {
    // sydbølge langs tangen, sydvind 10 m/s (13/10)
    hs = 1.4;
    tp = 6.0;
    swdir = 190;
    wdir = 200;
    wspd = 10;
    gust = 14;
  } else if (dayOff === 2) {
    // vestenvind 12 m/s, blæst ud, vandet stuvet op (14/10)
    hs = 2.0;
    tp = 6.5;
    swdir = 275;
    wdir = 270;
    wspd = 12;
    gust = 17;
    level = 0.7;
  } else if (dayOff === 3) {
    // hård fralandsvind, stor sø (11/10)
    hs = 2.0;
    tp = 7.5;
    swdir = 290;
    wdir = 100;
    wspd = 10;
    gust = 13;
    level = -0.2;
  } else {
    const k = (dayOff + 7) * 0.7 + hh / 24;
    hs = 0.5 + 0.6 * (0.5 + 0.5 * Math.sin(k));
    tp = 5 + 3 * (0.5 + 0.5 * Math.cos(k * 0.6));
    swdir = 280 + 30 * Math.sin(k * 0.3);
    wdir = (200 + 120 * Math.sin(k * 0.4) + 360) % 360;
    wspd = 4 + 4 * (0.5 + 0.5 * Math.sin(k * 0.9));
    gust = wspd + 3;
  }
  if (areaId === "thorsminde") hs *= 1.15;
  level += 0.25 * Math.sin((2 * Math.PI * hh) / 12.4);
  return {
    hs: round(hs),
    tp: round(tp, 1),
    swdir: round(swdir, 0),
    wdir: round(wdir, 0),
    wspd: round(wspd, 1),
    gust: round(gust, 1),
    level: round(level)
  };
}

// CachedForecast (lib/storage.ts): 7 dage tilbage og 7 frem, timevis.
export function seedForecast(now = new Date()) {
  const today = dateOf(localIso(now));
  const first = addDays(today, -7);
  const last = addDays(today, 7);
  const areas = {};
  for (const areaId of ["thyboroen", "thorsminde"]) {
    const rows = [];
    const seen = new Set();
    const t0 = new Date(now.getTime() - 9 * 86400_000);
    t0.setUTCMinutes(0, 0, 0);
    for (let i = 0; i < 24 * 18; i++) {
      const t = new Date(t0.getTime() + i * 3600_000);
      const iso = localIso(t);
      const date = dateOf(iso);
      if (date < first || date > last || seen.has(iso)) continue;
      seen.add(iso);
      const dayOff = Math.round(
        (Date.parse(date + "T12:00:00Z") - Date.parse(today + "T12:00:00Z")) / 86400_000
      );
      const hh = Number(iso.slice(11, 13));
      const c = conditions(dayOff, hh, areaId);
      rows.push({
        time: iso,
        hs: c.hs,
        tp: c.tp,
        swdir: c.swdir,
        swell: { hs: round(c.hs * 0.8), tp: c.tp, dir: c.swdir },
        windSea: { hs: round(c.hs * 0.5), tp: 4.5, dir: c.wdir },
        level: c.level,
        wdir: c.wdir,
        wspd: c.wspd,
        gust: c.gust,
        temp: 11
      });
    }
    areas[areaId] = { rows, holes: [], dry: false };
  }
  return { fetchedAt: new Date(now.getTime() - 25 * 60_000).toISOString(), areas };
}

// Obs (api/obs.ts): bøjen hver halve time og vandstanden hvert 10. minut,
// 48 timer tilbage, nyeste måling inden for den sidste halve time.
export function seedObs(now = new Date()) {
  const end = new Date(Math.floor(now.getTime() / 1800_000) * 1800_000);
  const buoy = [];
  const level = [];
  for (let i = 96; i >= 0; i--) {
    const t = new Date(end.getTime() - i * 1800_000);
    const k = i / 96;
    buoy.push({
      time: t.toISOString(),
      hs: round(1.6 + 0.5 * Math.sin(k * 6)),
      tp: null,
      tz: round(4.6 + 0.6 * Math.cos(k * 5)),
      hmax: round(2.6 + 0.7 * Math.sin(k * 6)),
      tmax: 6.5,
      dir: round(250 + 40 * Math.sin(k * 3), 1)
    });
  }
  for (let i = 288; i >= 0; i--) {
    const t = new Date(end.getTime() - i * 600_000);
    level.push({ time: t.toISOString(), m: round(0.1 + 0.3 * Math.sin((2 * Math.PI * i) / 74.4)) });
  }
  return {
    fetchedAt: new Date(end.getTime() + 5 * 60_000).toISOString(),
    hours: 48,
    buoy: { ident: "2035", name: "Fjaltring", source: "seed", header: "seed", rows: buoy, period: "T_z" },
    level: { stationId: "9004203", name: "Thyborøn Kyst", parameter: "sea_reg", rows: level },
    errors: []
  };
}
