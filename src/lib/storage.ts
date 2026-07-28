// Sidst hentede forecast gemmes lokalt, så appen kan åbnes uden net
// og vise noget med det samme. Ingen udløb — gamle data vises med
// deres hentetidspunkt, det er brugerens dømmekraft der afgør resten.

import type { Row } from "../model/model";

export interface CachedForecast {
  fetchedAt: string; // ISO
  rows: Row[];
  holes: string[]; // ISO-timer hvor kilden manglede data
}

const KEY = "bygtangen.forecast";

export function saveForecast(f: CachedForecast): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(f));
  } catch {
    // fuld storage er ikke kritisk — vi kører videre på det friske svar
  }
}

export function loadForecast(): CachedForecast | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const f = JSON.parse(raw) as CachedForecast;
    if (!Array.isArray(f.rows)) return null;
    return f;
  } catch {
    return null;
  }
}
