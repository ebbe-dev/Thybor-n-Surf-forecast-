// Henter bølge- og vindforecast fra Open-Meteo og fletter dem pr. time
// til Row[]. Ingen opfundne data: mangler en time i kilden, ryger den i
// `holes` og vises som hul i UI'et.
//
// Swell-felterne er ofte null i Nordsøen (ingen dønning at skille fra
// vindsøen). Så falder vi tilbage på wave_height/wave_period/wave_direction
// og markerer rækken med source: "vindsø".

import type { Row } from "../model/model";
import { WAVE_POINT, WIND_POINT } from "../config/spots";
import type { CachedForecast } from "../lib/storage";

export const MARINE_HOURLY =
  "wave_height,wave_direction,wave_period," +
  "swell_wave_height,swell_wave_period,swell_wave_direction,swell_wave_peak_period";

export const WIND_HOURLY =
  "wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m";

export const MARINE_BASE =
  "https://marine-api.open-meteo.com/v1/marine" +
  `?latitude=${WAVE_POINT.lat}&longitude=${WAVE_POINT.lon}` +
  `&hourly=${MARINE_HOURLY}&timezone=Europe%2FCopenhagen`;

export const WIND_BASE =
  "https://api.open-meteo.com/v1/forecast" +
  `?latitude=${WIND_POINT.lat}&longitude=${WIND_POINT.lon}` +
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
  if (body.error) throw new Error(`Open-Meteo: ${body.reason ?? "ukendt fejl"}`);
  return body;
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

export async function fetchForecast(): Promise<CachedForecast> {
  // 7 dage bagud + 7 frem: barografen kan swipes tilbage, og snapshots til
  // sessions logget bagudrettet findes uden at åbne historikken først.
  const [marine, wind] = await Promise.all([
    getJson<{ hourly: MarineHourly }>(MARINE_BASE + "&past_days=7&forecast_days=7"),
    getJson<{ hourly: WindHourly }>(WIND_BASE + "&past_days=7&forecast_days=7")
  ]);

  // Bølgemodellen har ramt land, hvis alt er null hele vejen igennem.
  if (marine.hourly.wave_height.every((v) => v == null)) {
    throw new Error(
      "Bølgemodellen returnerede kun null — gridcellen er tør. " +
        "Ret WAVE_POINT i src/config/spots.ts til en våd celle."
    );
  }

  const { rows, holes } = mergeHourly(marine.hourly, wind.hourly);
  return { fetchedAt: new Date().toISOString(), rows, holes };
}
