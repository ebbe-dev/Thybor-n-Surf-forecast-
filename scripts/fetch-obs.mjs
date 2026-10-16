// Henter MÅLTE tal fra kysten og skriver obs.json, som appen læser fra
// data-grenen (raw.githubusercontent.com tillader kald fra browseren).
// Kører i GitHub Actions hver halve time (.github/workflows/obs.yml).
//
// Kilder:
// - Kystdirektoratets bølgebøje ved Fjaltring (ud for Høfde Q, 17,5 m vand,
//   ETRS89/UTM32 441896/6259258):
//   https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=…&startdate=…&enddate=…&format=csv
//   Hvert 30. minut. Ident 2035 er den AKTIVE måler (start_dato 2023-08-18,
//   ingen slut_dato); 2031 var den gamle på samme sted, 1991-12-11 til
//   2023-08-18 (fundet 16/10/2026 ved at prøve ident 2000-2199). Datoerne
//   skal være ÅÅÅÅMMDD, og enddate er EKSKLUSIV ud over kl. 00:00 — skal
//   dagen i dag med, er enddate i morgen. Kolonner: H_M0 (signifikant
//   højde), T_s (tom hos 2035), H_max, T_max, H_1_3, H_avg, T_avg, T_z
//   (middelperiode), Dir, Dybde, East, North, start_dato, slut_dato.
// - DMI's åbne vandstands-API (ingen nøgle): stationer og observationer,
//   sea_reg (cm over DVR90 ≈ middelvandstand) hvert 10. minut — Thyborøn
//   Kyst 9004203 (Havn 9004201 stoppede i april 2026).
//
// Ingen opfundne data: fejler en kilde, står den tom i obs.json med fejlen,
// og appen viser "ikke målt". PROBE=1 skriver svar-hoveder og første linjer
// til loggen, så format og CORS kan aflæses første gang.

import { writeFileSync } from "node:fs";

const PROBE = process.env.PROBE === "1" || process.env.PROBE === "2";
const KDI_IDENTS = (process.env.KDI_IDENTS ?? "2035")
  .split(",").map((s) => s.trim()).filter(Boolean);
const KDI_TZ = process.env.KDI_TZ ?? "Europe/Copenhagen"; // bøjens tidsstempler
const HOURS = 48; // så langt tilbage obs.json rækker

const now = new Date();
const errors = [];
const log = (...a) => console.log(...a);

async function get(url, accept = "application/json") {
  const res = await fetch(url, { headers: { accept, "user-agent": "byg-tangen-obs/1 (+github.com/ebbe-dev)" } });
  const text = await res.text();
  if (PROBE) {
    log(`\n### ${url}\n    status ${res.status} · content-type ${res.headers.get("content-type")} · access-control-allow-origin ${res.headers.get("access-control-allow-origin") ?? "(ingen)"}`);
    log("    " + text.slice(0, 600).replace(/\n/g, "\n    "));
  }
  if (!res.ok) throw new Error(`${res.status} fra ${url}`);
  return text;
}

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;

// Et "lokalt" tidsstempel (uden zone) i en IANA-zone → ISO UTC.
function zonedToUtc(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asIf = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess - (asIf - guess)).toISOString();
}

// Kystdirektoratets datotid: "2026-10-16 09:30", "16-10-2026 09:30" eller med T.
function parseKdiTime(s) {
  const m = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/) ;
  if (m) return zonedToUtc(+m[1], +m[2], +m[3], +m[4], +m[5], KDI_TZ);
  const m2 = s.trim().match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})/);
  if (m2) return zonedToUtc(+m2[3], +m2[2], +m2[1], +m2[4], +m2[5], KDI_TZ);
  return null;
}

const num = (s) => {
  if (s == null) return null;
  const v = Number(String(s).trim().replace(",", "."));
  return Number.isFinite(v) ? v : null;
};

function parseKdiCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { header: lines[0] ?? "", rows: [] };
  const delim = (lines[0].match(/;/g) ?? []).length >= (lines[0].match(/,/g) ?? []).length ? ";" : ",";
  const header = lines[0].split(delim).map((h) => h.trim());
  const col = (names) => header.findIndex((h) => names.some((n) => h.toLowerCase().replace(/\s/g, "") === n));
  const iT = col(["datotid", "dato", "tid", "datetime", "time"]);
  const iHs = col(["h_s", "hs", "hm0", "h_m0"]);
  const iH13 = col(["h_1_3", "h13"]); // reserve, når H_M0 er tom
  const iTs = col(["t_s", "ts", "tp", "t_p"]); // spektral signifikant periode ≈ topperioden
  const iTz = col(["t_z", "tz", "t02", "tm02"]); // middelperiode
  const iTavg = col(["t_avg", "tavg"]);
  const iHmax = col(["h_max", "hmax"]);
  const iTmax = col(["t_max", "tmax"]);
  const iDir = col(["dir", "retning", "mdir", "dir_m"]);
  // Et nul i en periode-kolonne er en pladsholder, ikke en måling (16/10:
  // T_s står som 0 hos 2035, mens T_z har tal).
  const pick = (c, ...idx) => {
    for (const i of idx) if (i >= 0) { const v = num(c[i]); if (v != null && v > 0) return v; }
    return null;
  };
  const rows = [];
  for (const line of lines.slice(1)) {
    const c = line.split(delim);
    const time = iT >= 0 ? parseKdiTime(c[iT] ?? "") : null;
    const hs = pick(c, iHs, iH13);
    if (!time || hs == null) continue;
    rows.push({
      time, hs,
      tp: pick(c, iTs), // null hos 2035 — T_s er tom
      tz: pick(c, iTz, iTavg),
      hmax: pick(c, iHmax),
      tmax: pick(c, iTmax),
      dir: pick(c, iDir)
    });
  }
  return { header: header.join(" | "), rows };
}

async function fetchBuoy() {
  const start = new Date(now.getTime() - 3 * 86400_000);
  const end = new Date(now.getTime() + 86400_000); // enddate er eksklusiv: i morgen giver dagen i dag med
  for (const ident of KDI_IDENTS) {
    const url = `https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=${ident}&startdate=${ymd(start)}&enddate=${ymd(end)}&format=csv`;
    try {
      const text = await get(url, "text/csv,text/plain,*/*");
      const { header, rows } = parseKdiCsv(text);
      const fresh = rows.filter((r) => Date.parse(r.time) >= now.getTime() - HOURS * 3600_000);
      log(`bøje ident ${ident}: ${rows.length} rækker, ${fresh.length} inden for ${HOURS} t · kolonner: ${header}`);
      if (fresh.length > 0) {
        fresh.sort((a, b) => (a.time < b.time ? -1 : 1));
        // Tidszone-kontrol: læst som ${KDI_TZ} må den nyeste række hverken
        // ligge i fremtiden (stemplerne er så UTC) eller være timer gammel
        // (stemplerne er så lokale, men læst som UTC). Loggen viser det.
        const newest = fresh.at(-1);
        const ageMin = Math.round((now.getTime() - Date.parse(newest.time)) / 60_000);
        log(`bøje: nyeste række ${newest.time} læst som ${KDI_TZ} er ${ageMin} min gammel ved hentning ${now.toISOString()}`);
        if (ageMin < -15) errors.push(`bøje: nyeste række ligger ${-ageMin} min i fremtiden — KDI_TZ=${KDI_TZ} er nok forkert`);
        if (PROBE) await lagProbe(fresh);
        return { ident, name: "Fjaltring", source: url.replace(/startdate=.*$/, "…"), header, rows: fresh, period: newest.tp != null ? "T_s" : "T_z" };
      }
    } catch (e) {
      errors.push(`bøje ${ident}: ${e.message}`);
      log(`bøje ident ${ident}: ${e.message}`);
    }
  }
  errors.push("bøje: ingen ident gav friske rækker");
  return null;
}

// PROBE: bøjens højde holdt op mod Open-Meteos bølgehøjde for bøjens eget
// punkt (56,49 N 8,10 Ø), forskudt −3..+3 timer. Det forskud, der passer
// bedst, siger om bøjens stempler er læst i den rigtige zone: passer 0 bedst,
// er KDI_TZ rigtig; passer −2 bedst (bøjen læst 2 t for tidligt), er
// stemplerne UTC. Kun til loggen — rører ikke obs.json.
async function lagProbe(rows) {
  try {
    const url = "https://marine-api.open-meteo.com/v1/marine?latitude=56.49&longitude=8.10&hourly=wave_height&past_days=3&forecast_days=1&timezone=UTC";
    const j = JSON.parse(await get(url));
    const model = new Map();
    j.hourly.time.forEach((t, i) => { if (j.hourly.wave_height[i] != null) model.set(Date.parse(t + ":00Z"), j.hourly.wave_height[i]); });
    const out = [];
    for (let lagH = -3; lagH <= 3; lagH++) {
      const diffs = [];
      for (const r of rows) {
        const t = Date.parse(r.time) + lagH * 3600_000;
        if (t % 3600_000 !== 0) continue; // kun hele timer
        const m = model.get(t);
        if (m != null) diffs.push(m - r.hs);
      }
      if (diffs.length < 6) continue;
      const mean = diffs.reduce((s, v) => s + v, 0) / diffs.length;
      const rmse = Math.sqrt(diffs.reduce((s, v) => s + (v - mean) ** 2, 0) / diffs.length);
      out.push(`forskud ${lagH >= 0 ? "+" : ""}${lagH} t: ${diffs.length} par, model−bøje ${mean.toFixed(2)} m, spredning ${rmse.toFixed(3)} m`);
    }
    log("tidszone-prøve (bøjen læst som " + KDI_TZ + "; mindste spredning vinder):\n    " + out.join("\n    "));
  } catch (e) { log("tidszone-prøve fejlede:", e.message); }
}

async function fetchLevel() {
  const base = "https://opendataapi.dmi.dk/v2/oceanObs/collections";
  const stText = await get(`${base}/station/items?limit=1000`);
  const st = JSON.parse(stText);
  const feats = (st.features ?? []).map((f) => f.properties ?? {});
  const thy = feats.filter((p) => /thybor/i.test(p.name ?? ""));
  log("DMI-stationer med Thyborøn i navnet:", thy.map((p) => `${p.stationId} ${p.name} (${p.status ?? ""})`).join(" · ") || "ingen");
  if (thy.length === 0) { errors.push("vandstand: ingen DMI-station med Thyborøn i navnet"); return null; }
  // kysten først, så havnen; aktive først. Parameteren er sea_reg hos
  // Kystdirektoratets målere (målt 16/10/2026: Thyborøn Kyst 9004203 svarer
  // hvert 10. minut; Thyborøn Havn 9004201 stoppede i april 2026).
  thy.sort((a, b) => (/kyst/i.test(b.name) ? 1 : 0) - (/kyst/i.test(a.name) ? 1 : 0) || ((b.status === "Active") - (a.status === "Active")));
  const from = new Date(now.getTime() - HOURS * 3600_000).toISOString().replace(/\.\d{3}Z$/, "Z");
  const to = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  for (const s of thy) {
    for (const param of ["sea_reg", "sealev_dvr", "sealev_ln"]) {
      try {
        const text = await get(`${base}/observation/items?stationId=${s.stationId}&parameterId=${param}&datetime=${from}/${to}&limit=1000`);
        const j = JSON.parse(text);
        const rows = (j.features ?? [])
          .map((f) => f.properties ?? {})
          .filter((p) => p.observed && typeof p.value === "number")
          .map((p) => ({ time: new Date(p.observed).toISOString(), m: Math.round(p.value) / 100 }))
          .sort((a, b) => (a.time < b.time ? -1 : 1));
        log(`vandstand ${s.stationId} ${s.name} ${param}: ${rows.length} rækker`);
        if (rows.length > 0) return { stationId: s.stationId, name: s.name, parameter: param, rows };
      } catch (e) {
        errors.push(`vandstand ${s.stationId} ${param}: ${e.message}`);
        log(`vandstand ${s.stationId} ${param}: ${e.message}`);
      }
    }
  }
  errors.push("vandstand: ingen station gav rækker");
  return null;
}

// PROBE=2: dyb undersøgelse af kilderne, når de svarer tomt — hvilke
// idents har data, hvilket tidsformat, hvilke parametre og tider DMI har.
async function deepProbe() {
  const base = "https://opendataapi.dmi.dk/v2/oceanObs/collections";
  for (const st of ["9004203", "9004201"]) {
    for (const q of [
      `observation/items?stationId=${st}&limit=3&sortorder=observed,DESC`,
      `observation/items?stationId=${st}&parameterId=sea_reg&limit=3&sortorder=observed,DESC`,
      `observation/items?stationId=${st}&parameterId=sealev_dvr&limit=3&sortorder=observed,DESC`,
      `observation/items?stationId=${st}&parameterId=sealev_dvr&limit=3`,
      `station/items?stationId=${st}`
    ]) {
      try { await get(`${base}/${q}`); } catch (e) { log("    fejl:", e.message); }
    }
  }
  for (const ident of KDI_IDENTS) {
    for (const [a, b] of [["20250601", "20250603"], ["20261001", "20261015"]]) {
      try {
        const text = await get(`https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=${ident}&startdate=${a}&enddate=${b}&format=csv`, "text/csv,*/*");
        const lines = text.split(/\r?\n/).filter((l) => l.trim());
        log(`    ident ${ident} ${a}-${b}: ${lines.length - 1} rækker · første: ${lines[1] ?? "-"} · sidste: ${lines.at(-1) ?? "-"}`);
      } catch (e) { log("    fejl:", e.message); }
    }
  }
  // Kystdirektoratets tjeneste svarede kun med hovedet for alle idents (16/10):
  // prøv dokumentationens eget eksempel, andre datoformater, dygraph, og
  // læs tjenestens egen side og kortsidens indlejrede adresser.
  for (const q of [
    "ident=2031&startdate=20181001&enddate=20181002&format=csv",
    "ident=2133&startdate=2026-10-13&enddate=2026-10-16&format=csv",
    "ident=2133&startdate=20261013&enddate=20261016&format=dygraph",
    "ident=2133&startdate=20261013&enddate=20261016",
    "ident=2133",
    ""
  ]) {
    try {
      const text = await get(`https://kystatlas.kyst.dk/data/boelge/response.aspx?${q}`, "*/*");
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      log(`    [${q}] ${lines.length} linjer · 2.: ${(lines[1] ?? "-").slice(0, 160)}`);
    } catch (e) { log(`    [${q}] fejl: ${e.message}`); }
  }
  try {
    const res = await fetch("https://kystatlas.kyst.dk/data/boelge/boelge_webtjeneste.html", { headers: { "user-agent": "byg-tangen-obs/1" } });
    const html = await res.text();
    log("\n### boelge_webtjeneste.html som tekst:\n    " + html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3500));
  } catch (e) { log("    fejl:", e.message); }
  // Ident 2031 var Fjaltring 1991-12-11 til 2023-08-18 (slut_dato i svaret).
  // Den aktive måler har et andet ident: prøv alle 2000-2199 for de sidste 3
  // døgn, og læs kystatlas' egne sider (graf, kort, metadata) for navne.
  const start3 = new Date(now.getTime() - 3 * 86400_000);
  const found = [];
  for (let ident = 2000; ident < 2200; ident++) {
    try {
      const res = await fetch(`https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=${ident}&startdate=${ymd(start3)}&enddate=${ymd(now)}&format=csv`, { headers: { "user-agent": "byg-tangen-obs/1" } });
      const text = await res.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length > 1 && !/<html|<br>/i.test(lines[0])) found.push(`${ident}: ${lines.length - 1} rækker · sidste: ${lines.at(-1)}`);
    } catch (e) { log(`    ident ${ident}: ${e.message}`); }
  }
  log("\n### idents med friske rækker (2000-2199):\n    " + (found.join("\n    ") || "ingen"));
  for (const url of [
    "https://kystatlas.kyst.dk/data/boelge/boelge_graf.html",
    "https://kystatlas.kyst.dk/data/boelge/boelge_kort.html",
    "https://kystatlas.kyst.dk/data/boelge/boelge_metadata.html",
    "https://kystatlas.kyst.dk/data/boelge/boelge_arkiv.html",
    "https://kystatlas.kyst.dk/data/boelge/boelge_graf_en.html",
    "https://kyst.dk/hav-og-anlaeg/maalinger-og-data/boelgemaalinger/kort-over-kystdirektoratets-boelgemaalere",
    "https://kyst.dk/hav-og-anlaeg/maalinger-og-data/boelgemaalinger",
    "https://kystatlas.kyst.dk/data/boelge/boelge_webtjeneste.html"
  ]) {
    try {
      const res = await fetch(url, { headers: { "user-agent": "byg-tangen-obs/1" } });
      const html = await res.text();
      log(`\n### ${url} · status ${res.status} · ${html.length} tegn`);
      const hits = [...html.matchAll(/Fjaltring/gi)].slice(0, 12);
      for (const h of hits) log("    …" + html.slice(Math.max(0, h.index - 220), h.index + 220).replace(/\s+/g, " ") + "…");
      const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/gi)].map((m) => m[1]).slice(0, 20);
      if (scripts.length) log("    scripts:", scripts.join(" · "));
      const opts = [...html.matchAll(/<option[^>]*value="?(\d{3,5})"?[^>]*>([^<]{0,60})/gi)].slice(0, 60);
      if (opts.length) log("    options:", opts.map((m) => `${m[1]}=${m[2].trim()}`).join(" · "));
      const srcs = [...html.matchAll(/(?:src|href|data-src|data-url)="([^"]*(?:kystatlas|boelge|bolge|wave|arcgis|api)[^"]*)"/gi)].map((m) => m[1]).slice(0, 40);
      if (srcs.length) log("    adresser:", [...new Set(srcs)].join("\n              "));
    } catch (e) { log("    fejl:", e.message); }
  }
}
if (process.env.PROBE === "2") await deepProbe();

const [buoy, level] = await Promise.all([
  fetchBuoy().catch((e) => { errors.push("bøje: " + e.message); return null; }),
  fetchLevel().catch((e) => { errors.push("vandstand: " + e.message); return null; })
]);

const out = { fetchedAt: now.toISOString(), hours: HOURS, buoy, level, errors };
writeFileSync("obs.json", JSON.stringify(out));
log(`\nobs.json: bøje ${buoy ? buoy.rows.length + " rækker, seneste " + buoy.rows.at(-1).time : "ingen"} · vandstand ${level ? level.rows.length + " rækker, seneste " + level.rows.at(-1).time : "ingen"} · fejl ${errors.length}`);
if (buoy) log("bøjens seneste:", JSON.stringify(buoy.rows.at(-1)), "· hentet", now.toISOString());
