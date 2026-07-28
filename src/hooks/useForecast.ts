// Viser cached forecast med det samme og henter frisk i baggrunden.
// Offline eller fejl → vi bliver på det cachede med tydelig markering.

import { useEffect, useState } from "react";
import { fetchForecast } from "../api/openMeteo";
import { loadForecast, saveForecast, type CachedForecast } from "../lib/storage";

export type ForecastStatus = "henter" | "frisk" | "cached" | "fejl";

export function useForecast() {
  const [forecast, setForecast] = useState<CachedForecast | null>(() => loadForecast());
  const [status, setStatus] = useState<ForecastStatus>("henter");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchForecast()
      .then((f) => {
        if (!alive) return;
        saveForecast(f);
        setForecast(f);
        setStatus("frisk");
        setError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus(loadForecast() ? "cached" : "fejl");
      });
    return () => {
      alive = false;
    };
  }, []);

  return { forecast, status, error };
}
