// Probe af Open-Meteo — kørt fra GitHub Actions, fordi Claude-containeren
// ikke når open-meteo.com. Kun log, ingen filer. Kør: obs.yml med
// openmeteo=true. Svarer på det, docs/naeste-session.md §4 (punkt 2, 4 og 8)
// bad om at få efterprøvet, før der bygges på det:
//   1. hvilke bølgemodeller `models=` kender for appens to bølgepunkter, og
//      hvor langt hver af dem rækker (dage med tal),
//   2. hvilke variabler marine-API'et kender (sekundær/tertiær dønning,
//      vandtemperatur, topperiode, strøm),
//   3. hvordan svaret ser ud med flere modeller i ét kald (nøglenavne),
//   4. om de ekstra variabler findes pr. model,
//   5. om vind-API'ets best_match er DMI's HARMONIE for Nordeuropa.

const AREAS = [
  { id: "thyboroen", lat: 56.66, lon: 8.13 },
  { id: "thorsminde", lat: 56.45, lon: 8.0 }
];
const WIND = { lat: 56.68, lon: 8.2 };
const MARINE = "https://marine-api.open-meteo.com/v1/marine";
const FORECAST = "https://api.open-meteo.com/v1/forecast";

const MODELS = [
  "best_match",
  "ewam",
  "gwam",
  "meteofrance_wave",
  "meteofrance_currents",
  "ecmwf_wam025",
  "ncep_gfswave025",
  "ncep_gefswave025",
  "era5_ocean"
];
const VARS = [
  "wave_height",
  "wave_direction",
  "wave_period",
  "wave_peak_period",
  "wind_wave_height",
  "wind_wave_period",
  "wind_wave_peak_period",
  "wind_wave_direction",
  "swell_wave_height",
  "swell_wave_period",
  "swell_wave_peak_period",
  "swell_wave_direction",
  "secondary_swell_wave_height",
  "secondary_swell_wave_period",
  "secondary_swell_wave_direction",
  "secondary_swell_wave_peak_period",
  "tertiary_swell_wave_height",
  "tertiary_swell_wave_period",
  "tertiary_swell_wave_direction",
  "sea_surface_temperature",
  "sea_level_height_msl",
  "invert_barometer_height",
  "ocean_current_velocity",
  "ocean_current_direction"
];
const WIND_MODELS = ["best_match", "dmi_seamless", "dmi_harmonie_arome_europe", "ecmwf_ifs025", "icon_seamless"];

const coords = `latitude=${AREAS.map((a) => a.lat).join(",")}&longitude=${AREAS.map((a) => a.lon).join(",")}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const asArr = (j) => (Array.isArray(j) ? j : [j]);
const nonNull = (arr) => (arr ?? []).filter((v) => v != null);

async function call(url) {
  await sleep(250); // høfligt mod den gratis tjeneste
  const res = await fetch(url, { headers: { "user-agent": "byg-tangen-probe/1 (+github.com/ebbe-dev)" } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // ikke JSON — status og tekst fortæller det
  }
  const reason = json && !Array.isArray(json) && json.error ? json.reason : null;
  return { status: res.status, json, reason, text: text.slice(0, 200) };
}

// "96 af 168 timer har tal, fra … til … · 0h=1.2 24h=1.4 …"
function describeSeries(time, vals) {
  const idx = (vals ?? []).map((v, i) => (v != null ? i : -1)).filter((i) => i >= 0);
  if (idx.length === 0) return "ingen tal";
  const first = idx[0];
  const last = idx[idx.length - 1];
  const sample = [0, 24, 72, 120, 167]
    .filter((i) => i < vals.length)
    .map((i) => `${i}h=${vals[i] ?? "–"}`)
    .join(" ");
  return `${idx.length} af ${vals.length} timer har tal, ${time?.[first]}–${time?.[last]} · ${sample}`;
}

async function section(title, fn) {
  log(`\n### ${title}`);
  try {
    await fn();
  } catch (e) {
    log(`  FEJL: ${e.message}`);
  }
}

const okModels = [];
const okVars = [];

await section("1. Bølgemodeller (models=), 7 døgn, begge bølgepunkter", async () => {
  for (const m of MODELS) {
    const { status, json, reason, text } = await call(
      `${MARINE}?${coords}&hourly=wave_height,wave_period,wave_direction&models=${m}&forecast_days=7&timezone=UTC`
    );
    if (status !== 200 || !json) {
      log(`  ${m}: HTTP ${status} · ${reason ?? text}`);
      continue;
    }
    let any = false;
    asArr(json).forEach((loc, i) => {
      const h = loc.hourly ?? {};
      const keys = Object.keys(h).filter((k) => k !== "time");
      const hk = keys.find((k) => k.startsWith("wave_height"));
      const vals = hk ? h[hk] : [];
      if (nonNull(vals).length > 0) any = true;
      log(`  ${m} @ ${AREAS[i]?.id}: nøgler ${keys.join(",")} · højde: ${describeSeries(h.time, vals)}`);
    });
    if (any) okModels.push(m);
  }
  log(`  → modeller med tal: ${okModels.join(", ") || "ingen"}`);
});

await section("2. Variabler i marine-API'et (best_match, 3 døgn)", async () => {
  for (const v of VARS) {
    const { status, json, reason, text } = await call(`${MARINE}?${coords}&hourly=${v}&forecast_days=3&timezone=UTC`);
    if (status !== 200 || !json) {
      log(`  ${v}: HTTP ${status} · ${reason ?? text}`);
      continue;
    }
    okVars.push(v);
    const parts = asArr(json).map((loc, i) => {
      const vals = loc.hourly?.[v] ?? [];
      const nn = nonNull(vals);
      const unit = loc.hourly_units?.[v] ?? "";
      return `${AREAS[i]?.id}: ${nn.length}/${vals.length} tal${nn.length ? `, fx ${nn[0]}…${nn[nn.length - 1]} ${unit}` : ""}`;
    });
    log(`  ${v}: OK · ${parts.join(" · ")}`);
  }
  log(`  → variabler, tjenesten kender: ${okVars.join(", ") || "ingen"}`);
});

await section("3. Flere modeller i ét kald (nøglenavne og tal pr. model)", async () => {
  const multi = okModels.filter((m) => m !== "best_match");
  if (multi.length === 0) {
    log("  ingen modeller at prøve");
    return;
  }
  const { status, json, reason, text } = await call(
    `${MARINE}?${coords}&hourly=wave_height,wave_period&models=${multi.join(",")}&forecast_days=7&timezone=UTC`
  );
  if (status !== 200 || !json) {
    log(`  HTTP ${status} · ${reason ?? text}`);
    return;
  }
  asArr(json).forEach((loc, i) => {
    const h = loc.hourly ?? {};
    log(`  @ ${AREAS[i]?.id}: nøgler ${Object.keys(h).join(",")}`);
    const hk = Object.keys(h).filter((k) => k.startsWith("wave_height"));
    for (const t of [0, 24, 48, 72, 96, 120, 144, 167]) {
      if (!h.time?.[t]) continue;
      log(`    ${h.time[t]}: ${hk.map((k) => `${k.replace("wave_height", "") || "(uden suffix)"}=${h[k][t] ?? "–"}`).join(" ")}`);
    }
  });
  // samme kald med best_match i rækken — får den et suffix?
  const r2 = await call(`${MARINE}?${coords}&hourly=wave_height&models=best_match,${multi[0]}&forecast_days=1&timezone=UTC`);
  log(`  best_match,${multi[0]}: HTTP ${r2.status} · nøgler ${r2.json ? Object.keys(asArr(r2.json)[0]?.hourly ?? {}).join(",") : r2.reason ?? r2.text}`);
});

await section("4. Sekundær dønning, topperiode og vandtemperatur pr. model (sydpunktet)", async () => {
  const extra = [
    "secondary_swell_wave_height",
    "secondary_swell_wave_period",
    "secondary_swell_wave_direction",
    "tertiary_swell_wave_height",
    "swell_wave_peak_period",
    "wave_peak_period",
    "sea_surface_temperature"
  ].filter((v) => okVars.includes(v));
  if (extra.length === 0) {
    log("  ingen af de ekstra variabler kendes — intet at prøve pr. model");
    return;
  }
  for (const m of okModels) {
    const { status, json, reason, text } = await call(
      `${MARINE}?${coords}&hourly=${extra.join(",")}&models=${m}&forecast_days=3&timezone=UTC`
    );
    if (status !== 200 || !json) {
      log(`  ${m}: HTTP ${status} · ${reason ?? text}`);
      continue;
    }
    const locs = asArr(json);
    const loc = locs[1] ?? locs[0];
    const h = loc.hourly ?? {};
    log(
      `  ${m}: ` +
        extra
          .map((v) => {
            const k = Object.keys(h).find((key) => key.startsWith(v));
            const nn = nonNull(k ? h[k] : []);
            return `${v}=${nn.length} tal${nn.length ? ` (fx ${nn[0]})` : ""}`;
          })
          .join(" · ")
    );
  }
});

await section("5. Vind-API: best_match mod DMI (56,68 N 8,20 Ø, 48 t)", async () => {
  const series = {};
  for (const m of WIND_MODELS) {
    const { status, json, reason, text } = await call(
      `${FORECAST}?latitude=${WIND.lat}&longitude=${WIND.lon}&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&models=${m}&forecast_days=2&timezone=UTC`
    );
    if (status !== 200 || !json) {
      log(`  ${m}: HTTP ${status} · ${reason ?? text}`);
      continue;
    }
    const h = json.hourly ?? {};
    const sk = Object.keys(h).find((k) => k.startsWith("wind_speed_10m"));
    series[m] = sk ? h[sk] : [];
    log(
      `  ${m}: nøgler ${Object.keys(h).join(",")} · ${nonNull(series[m]).length} tal · 0h=${series[m][0]} 12h=${series[m][12]} 36h=${series[m][36]}`
    );
  }
  const bm = series.best_match;
  if (!bm) return;
  for (const [m, s] of Object.entries(series)) {
    if (m === "best_match") continue;
    let n = 0;
    let eq = 0;
    let sum = 0;
    s.forEach((v, i) => {
      if (v != null && bm[i] != null) {
        n++;
        if (v === bm[i]) eq++;
        sum += Math.abs(v - bm[i]);
      }
    });
    log(`  best_match mod ${m}: ${n} timer, ${eq} helt ens, snit |forskel| ${(n ? sum / n : NaN).toFixed(2)} m/s`);
  }
});

log("\nprobe færdig");
