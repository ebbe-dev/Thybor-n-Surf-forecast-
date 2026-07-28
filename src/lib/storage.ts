// Sidst hentede forecast gemmes lokalt, så appen kan åbnes uden net
// og vise noget med det samme. Ingen udløb — gamle data vises med
// deres hentetidspunkt, det er brugerens dømmekraft der afgør resten.

import type { Row } from "../model/model";

export interface AreaForecast {
  rows: Row[];
  holes: string[]; // ISO-timer hvor kilden manglede data
  dry: boolean; // bølgecellen ramte land — området har ingen data
}

export interface CachedForecast {
  fetchedAt: string; // ISO
  areas: Record<string, AreaForecast>;
}

// v2: område-opdelt (flere vejr-områder). Gammel v1-cache ignoreres —
// første åbning efter opdateringen henter frisk.
const KEY = "bygtangen.forecast2";

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
    if (!f.areas || typeof f.areas !== "object") return null;
    return f;
  } catch {
    return null;
  }
}
