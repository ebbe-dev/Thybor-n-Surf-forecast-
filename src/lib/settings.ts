// Små valg, der huskes på telefonen (localStorage) — i samme ånd som
// forecast-cachen og spot-bekræftelserne: ingen backend.

import { DEFAULT_HORIZON, HORIZON_OPTIONS, type HorizonDays } from "./blocks";

const HORIZON_KEY = "bygtangen.horizon";

// Forsidens horisont: 2 døgn (standard) eller 7 dage.
export function loadHorizonDays(): HorizonDays {
  const v = Number(localStorage.getItem(HORIZON_KEY));
  return (HORIZON_OPTIONS as readonly number[]).includes(v) ? (v as HorizonDays) : DEFAULT_HORIZON;
}

export function saveHorizonDays(days: HorizonDays): void {
  localStorage.setItem(HORIZON_KEY, String(days));
}

const SURF_HEIGHT_KEY = "bygtangen.surfheight";

// Bølgens front (lib/surfHeight.ts) ved tallene: til (standard) eller fra.
// Kontakten står under Indstillinger på NU.
export function loadSurfHeightOn(): boolean {
  return localStorage.getItem(SURF_HEIGHT_KEY) !== "0";
}

export function saveSurfHeightOn(on: boolean): void {
  localStorage.setItem(SURF_HEIGHT_KEY, on ? "1" : "0");
}
