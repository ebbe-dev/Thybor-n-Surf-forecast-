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
