// Henter bølge- og vindforecast fra Open-Meteo for ALLE vejr-områder i ét
// kald pr. endpoint (kommaseparerede koordinater → array-svar) og fletter
// pr. område til Row[]. Ingen opfundne data: mangler en time, ryger den i
// `holes`; er et områdes bølgecelle tør, markeres området — de andre
// områder kører videre.
//
// Rækken bærer den SAMLEDE sø (wave_*): det er den, der bryder på revlen,
// og det er den, DMI's kort viser. Dønningen (swell_*) og vindsøen
// (wind_wave_*) står ved siden af som dele, så appen kan sige, hvad søen
// består af. Til 13/10/2026 bar rækken dønningen alene, når modellen kunne
// skille den ud: på en dag med 1,5 m vindsø fra syd stod appen så med en
// lille NV-dønning, mens surferne stod i sydbølgen (docs/surf-science.md).
//
// Perioden i rækken er den dominerende dels TOPPERIODE, når den del bærer
// mindst halvdelen af energien; ellers den samlede middelperiode. Middel-
// perioden for en blandet sø trækkes ned af vindsøen, og det er toppen,
// surfere læser.
//
// Vindsøen og vandstanden hentes i et EKSTRA kald, der må fejle: kernen
// (højde, retning, periode, dønning, vind) falder aldrig på dem.
//
// Modelspredningen (17/10/2026) er et tredje kald, der også må fejle: den
// samme højde fra flere bølgemodeller på én gang, så rækken kan bære
// modellernes spænd (hsSpread) og appen sige "±0,4 m" og "usikker", når de
// er uenige. Scoren regner stadig på best_match alene.

import type { Row, WavePart, HsSpread } from "../model/model";
import { AREAS } from "../config/spots";
import type { CachedForecast, AreaForecast } from "../lib/storage";

export const MARINE_HOURLY =
  "wave_height,wave_direction,wave_period," +
  "swell_wave_height,swell_wave_period,swell_wave_direction,swell_wave_peak_period";

// Ekstra, fail-open: vindsøen med topperiode og vandstanden over middel
// (tidevand + lufttryk + havmodellens overfladehøjde; ikke en kystnær
// stormflodsmodel — docs/surf-science.md, afsnittet om vandstand).
export const MARINE_EXTRA_HOURLY =
  "wind_wave_height,wind_wave_period,wind_wave_direction,wind_wave_peak_period,sea_level_height_msl";

export const WIND_HOURLY =
  "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m";

// Modelspredning, fail-open. Probe fra GitHub Actions 17/10/2026
// (scripts/probe-openmeteo.mjs): best_match er her Météo-Frances MFWAM
// (tallene er ens); ewam er DWD's europæiske 5 km-model og rækker 3,3
// døgn; gwam DWD's globale 28 km, 7 døgn; ecmwf_wam025 ECMWF's 0,25° —
// tør celle ved Thyborøn-punktet, kun sydpunktet; ncep_gfswave025 NOAA's,
// 7 døgn. Nøglerne i svaret hedder wave_height_<model>, for best_match
// wave_height_marine_best_match. Modeller uden tal for en time tæller ikke.
export const SPREAD_MODELS = ["best_match", "ewam", "gwam", "ecmwf_wam025", "ncep_gfswave025"];

const WAVE_COORDS =
  `latitude=${AREAS.map((a) => a.wave.lat).join(",")}` +
  `&longitude=${AREAS.map((a) => a.wave.lon).join(",")}`;

const WIND_COORDS =
  `latitude=${AREAS.map((a) => a.wind.lat).join(",")}` +
  `&longitude=${AREAS.map((a) => a.wind.lon).join(",")}`;

export const MARINE_BASE =
  `https://marine-api.open-meteo.com/v1/marine?${WAVE_COORDS}` +
  `&hourly=${MARINE_HOURLY}&timezone=Europe%2FCopenhagen`;

export const MARINE_EXTRA_BASE =
  `https://marine-api.open-meteo.com/v1/marine?${WAVE_COORDS}` +
  `&hourly=${MARINE_EXTRA_HOURLY}&timezone=Europe%2FCopenhagen`;

export const MARINE_SPREAD_BASE =
  `https://marine-api.open-meteo.com/v1/marine?${WAVE_COORDS}` +
  `&hourly=wave_height&models=${SPREAD_MODELS.join(",")}&timezone=Europe%2FCopenhagen`;

export const WIND_BASE =
  `https://api.open-meteo.com/v1/forecast?${WIND_COORDS}` +
  `&hourly=${WIND_HOURLY}&wind_speed_unit=ms&timezone=Europe%2FCopenhagen`;

export const ARCHIVE_WIND_BASE =
  `https://archive-api.open-meteo.com/v1/archive?${WIND_COORDS}` +
  `&hourly=${WIND_HOURLY}&wind_speed_unit=ms&timezone=Europe%2FCopenhagen`;

export interface MarineHourly {
  time: string[];
  wave_height: (number | null)[];
  wave_direction: (number | null)[];
  wave_period: (number | null)[];
  swell_wave_height: (number | null)[];
  swell_wave_period: (number | null)[];
  swell_wave_direction: (number | null)[];
  swell_wave_peak_period?: (number | null)[];
}

export interface MarineExtraHourly {
  time: string[];
  wind_wave_height?: (number | null)[];
  wind_wave_period?: (number | null)[];
  wind_wave_direction?: (number | null)[];
  wind_wave_peak_period?: (number | null)[];
  sea_level_height_msl?: (number | null)[];
}

// Flere modeller i ét kald: wave_height_<model> pr. model.
export interface MarineSpreadHourly {
  time: string[];
  [key: string]: (number | null)[] | string[];
}

export interface WindHourly {
  time: string[];
  wind_speed_10m: (number | null)[];
  wind_direction_10m: (number | null)[];
  wind_gusts_10m: (number | null)[];
  temperature_2m: (number | null)[];
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo svarede ${res.status}`);
  const body = (await res.json()) as T & { error?: boolean; reason?: string };
  if (!Array.isArray(body) && (body as { error?: boolean }).error)
    throw new Error(`Open-Meteo: ${(body as { reason?: string }).reason ?? "ukendt fejl"}`);
  return body;
}

// Ét koordinatsæt → objekt, flere → array. Normalisér til array.
export function asArray<T>(x: T | T[]): T[] {
  return Array.isArray(x) ? x : [x];
}

const at = (arr: (number | null)[] | undefined, i: number | undefined): number | null =>
  arr && i != null ? (arr[i] ?? null) : null;

function wavePart(hs: number | null, tp: number | null, dir: number | null): WavePart | null {
  return hs != null && tp != null && dir != null ? { hs, tp, dir } : null;
}

// Den del, der bærer mindst halvdelen af energien (højde²), giver rækkens
// periode — sin topperiode. Ingen del gør det → null, og kalderen falder
// tilbage på den samlede middelperiode.
export function dominantPeriod(
  hs: number | null,
  swell: WavePart | null,
  windSea: WavePart | null
): number | null {
  if (hs == null || hs <= 0) return null;
  const parts = [swell, windSea].filter((p): p is WavePart => p !== null);
  if (parts.length === 0) return null;
  const top = parts.reduce((a, b) => (b.hs > a.hs ? b : a));
  return top.hs * top.hs >= 0.5 * hs * hs ? top.tp : null;
}

// Pr. time: laveste og højeste højde blandt de modeller, der havde et tal,
// og hvor mange. Én model alene er ikke et spænd.
export function spreadByTime(h: MarineSpreadHourly | null | undefined): Map<string, HsSpread> {
  const out = new Map<string, HsSpread>();
  if (!h || !Array.isArray(h.time)) return out;
  const keys = Object.keys(h).filter((k) => k.startsWith("wave_height"));
  h.time.forEach((t, i) => {
    const vals: number[] = [];
    for (const k of keys) {
      const v = (h[k] as (number | null)[])[i];
      if (typeof v === "number" && Number.isFinite(v)) vals.push(v);
    }
    if (vals.length >= 2) out.set(t, { lo: Math.min(...vals), hi: Math.max(...vals), n: vals.length });
  });
  return out;
}

// Fletter marine- og vindtimer til Rows. Bruges af både forecast og arkiv,
// så fallback-reglerne er garanteret ens alle steder. Ekstra-delen
// (vindsø, vandstand) er valgfri og matches på tidsstemplet.
export function mergeHourly(
  m: MarineHourly,
  w: WindHourly,
  x: MarineExtraHourly | null = null,
  spread: Map<string, HsSpread> | null = null
): { rows: Row[]; holes: string[] } {
  const windAt = new Map<string, number>();
  w.time.forEach((t, i) => windAt.set(t, i));
  const extraAt = new Map<string, number>();
  x?.time.forEach((t, i) => extraAt.set(t, i));

  const rows: Row[] = [];
  const holes: string[] = [];

  m.time.forEach((t, i) => {
    const wi = windAt.get(t);
    const wspd = at(w.wind_speed_10m, wi);
    const wdir = at(w.wind_direction_10m, wi);
    const gust = at(w.wind_gusts_10m, wi);
    const temp = at(w.temperature_2m, wi);

    const swell = wavePart(
      at(m.swell_wave_height, i),
      at(m.swell_wave_peak_period, i) ?? at(m.swell_wave_period, i),
      at(m.swell_wave_direction, i)
    );
    const xi = extraAt.get(t);
    const windSea = wavePart(
      at(x?.wind_wave_height, xi),
      at(x?.wind_wave_peak_period, xi) ?? at(x?.wind_wave_period, xi),
      at(x?.wind_wave_direction, xi)
    );
    const level = at(x?.sea_level_height_msl, xi);

    // Samlet sø; mangler den, bærer dønningen rækken (ældre svar).
    const hs = at(m.wave_height, i) ?? swell?.hs ?? null;
    const swdir = at(m.wave_direction, i) ?? swell?.dir ?? null;
    const tp = dominantPeriod(hs, swell, windSea) ?? at(m.wave_period, i) ?? swell?.tp ?? null;

    if (hs == null || tp == null || swdir == null || wspd == null || wdir == null || gust == null) {
      holes.push(t);
      return;
    }

    rows.push({
      time: t,
      hs,
      tp,
      swdir,
      swell,
      windSea,
      level,
      hsSpread: spread?.get(t) ?? null,
      wdir,
      wspd,
      gust,
      temp
    });
  });

  return { rows, holes };
}

type MarineResp = { hourly: MarineHourly };
type MarineExtraResp = { hourly: MarineExtraHourly };
type MarineSpreadResp = { hourly: MarineSpreadHourly };
type WindResp = { hourly: WindHourly };

// Bygger område-opdelte forecasts af parallelle API-svar (samme index-
// rækkefølge som AREAS, da URL'erne bygges af AREAS).
export function splitByArea(
  marines: MarineResp[],
  winds: WindResp[],
  extras: (MarineExtraResp | null)[] | null = null,
  spreads: (MarineSpreadResp | null)[] | null = null
): Record<string, AreaForecast> {
  const areas: Record<string, AreaForecast> = {};
  AREAS.forEach((a, i) => {
    const m = marines[i]?.hourly;
    const w = winds[i]?.hourly;
    if (!m || !w) {
      areas[a.id] = { rows: [], holes: [], dry: true };
      return;
    }
    const x = extras?.[i]?.hourly ?? null;
    const sp = spreadByTime(spreads?.[i]?.hourly);
    const dry = m.wave_height.every((v) => v == null);
    const merged = dry ? { rows: [], holes: [] } : mergeHourly(m, w, x, sp);
    areas[a.id] = { ...merged, dry };
  });
  return areas;
}

export async function fetchForecast(): Promise<CachedForecast> {
  // 7 dage bagud + 7 frem: barografen kan swipes tilbage, og snapshots til
  // sessions logget bagudrettet findes uden at åbne historikken først.
  const span = "&past_days=7&forecast_days=7";
  const [marineRes, windRes, extraRes, spreadRes] = await Promise.all([
    getJson<MarineResp | MarineResp[]>(MARINE_BASE + span),
    getJson<WindResp | WindResp[]>(WIND_BASE + span),
    getJson<MarineExtraResp | MarineExtraResp[]>(MARINE_EXTRA_BASE + span).catch((e: unknown) => {
      console.warn("Open-Meteo: vindsø og vandstand faldt fra —", e);
      return null;
    }),
    getJson<MarineSpreadResp | MarineSpreadResp[]>(MARINE_SPREAD_BASE + span).catch((e: unknown) => {
      console.warn("Open-Meteo: modelspredningen faldt fra —", e);
      return null;
    })
  ]);

  const areas = splitByArea(
    asArray(marineRes),
    asArray(windRes),
    extraRes ? asArray(extraRes) : null,
    spreadRes ? asArray(spreadRes) : null
  );

  if (Object.values(areas).every((a) => a.dry)) {
    throw new Error(
      "Alle bølgepunkter returnerede kun null — gridcellerne er tørre. " +
        "Ret AREAS i src/config/spots.ts."
    );
  }

  return { fetchedAt: new Date().toISOString(), areas };
}
