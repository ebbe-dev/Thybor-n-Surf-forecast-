// Henter bølge- og vindforecast fra Open-Meteo for ALLE vejr-områder i ét
// kald pr. endpoint (kommaseparerede koordinater → array-svar) og fletter
// pr. område til Row[]. Ingen opfundne data: mangler en time, ryger den i
// `holes`; er et områdes bølgecelle tør, markeres området — de andre
// områder kører videre.
//
// Swell-felterne er ofte null i Nordsøen (ingen dønning at skille fra
// vindsøen). Så falder vi tilbage på wave_height/wave_period/wave_direction
// og markerer rækken med source: "vindsø".

import type { Row } from "../model/model";
import { AREAS } from "../config/spots";
import type { CachedForecast, AreaForecast } from "../lib/storage";

export const MARINE_HOURLY =
  "wave_height,wave_direction,wave_period," +
  "swell_wave_height,swell_wave_period,swell_wave_direction,swell_wave_peak_period";

export const WIND_HOURLY =
  "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m";

const WAVE_COORDS =
  `latitude=${AREAS.map((a) => a.wave.lat).join(",")}` +
  `&longitude=${AREAS.map((a) => a.wave.lon).join(",")}`;

const WIND_COORDS =
  `latitude=${AREAS.map((a) => a.wind.lat).join(",")}` +
  `&longitude=${AREAS.map((a) => a.wind.lon).join(",")}`;

export const MARINE_BASE =
  `https://marine-api.open-meteo.com/v1/marine?${WAVE_COORDS}` +
  `&hourly=${MARINE_HOURLY}&timezone=Europe%2FCopenhagen`;

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

// Fletter marine- og vindtimer til Rows. Bruges af både forecast og arkiv,
// så fallback-reglerne er garanteret ens alle steder.
export function mergeHourly(m: MarineHourly, w: WindHourly): { rows: Row[]; holes: string[] } {
  const windAt = new Map<string, number>();
  w.time.forEach((t, i) => windAt.set(t, i));

  const rows: Row[] = [];
  const holes: string[] = [];

  m.time.forEach((t, i) => {
    const wi = windAt.get(t);
    const wspd = wi != null ? w.wind_speed_10m[wi] : null;
    const wdir = wi != null ? w.wind_direction_10m[wi] : null;
    const gust = wi != null ? w.wind_gusts_10m[wi] : null;
    const temp = wi != null ? (w.temperature_2m[wi] ?? null) : null;

    const swellOk =
      m.swell_wave_height[i] != null &&
      m.swell_wave_period[i] != null &&
      m.swell_wave_direction[i] != null;

    const hs = swellOk ? m.swell_wave_height[i] : m.wave_height[i];
    const tp = swellOk ? m.swell_wave_period[i] : m.wave_period[i];
    const swdir = swellOk ? m.swell_wave_direction[i] : m.wave_direction[i];

    if (hs == null || tp == null || swdir == null || wspd == null || wdir == null || gust == null) {
      holes.push(t);
      return;
    }

    rows.push({
      time: t,
      hs,
      tp,
      swdir,
      wdir,
      wspd,
      gust,
      temp,
      source: swellOk ? "swell" : "vindsø"
    });
  });

  return { rows, holes };
}

type MarineResp = { hourly: MarineHourly };
type WindResp = { hourly: WindHourly };

// Bygger område-opdelte forecasts af parallelle API-svar (samme index-
// rækkefølge som AREAS, da URL'erne bygges af AREAS).
export function splitByArea(
  marines: MarineResp[],
  winds: WindResp[]
): Record<string, AreaForecast> {
  const areas: Record<string, AreaForecast> = {};
  AREAS.forEach((a, i) => {
    const m = marines[i]?.hourly;
    const w = winds[i]?.hourly;
    if (!m || !w) {
      areas[a.id] = { rows: [], holes: [], dry: true };
      return;
    }
    const dry = m.wave_height.every((v) => v == null);
    const merged = dry ? { rows: [], holes: [] } : mergeHourly(m, w);
    areas[a.id] = { ...merged, dry };
  });
  return areas;
}

export async function fetchForecast(): Promise<CachedForecast> {
  // 7 dage bagud + 7 frem: barografen kan swipes tilbage, og snapshots til
  // sessions logget bagudrettet findes uden at åbne historikken først.
  const [marineRes, windRes] = await Promise.all([
    getJson<MarineResp | MarineResp[]>(MARINE_BASE + "&past_days=7&forecast_days=7"),
    getJson<WindResp | WindResp[]>(WIND_BASE + "&past_days=7&forecast_days=7")
  ]);

  const areas = splitByArea(asArray(marineRes), asArray(windRes));

  if (Object.values(areas).every((a) => a.dry)) {
    throw new Error(
      "Alle bølgepunkter returnerede kun null — gridcellerne er tørre. " +
        "Ret AREAS i src/config/spots.ts."
    );
  }

  return { fetchedAt: new Date().toISOString(), areas };
}
