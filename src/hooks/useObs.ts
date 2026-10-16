// Målingerne fra kysten (api/obs.ts): sidst hentede med det samme, frisk i
// baggrunden. Fejl → det cachede med status "cached", eller "fejl" uden
// cache. Ét kald pr. 5 minutter på tværs af fanerne — filen skifter kun
// hver halve time.

import { useEffect, useState } from "react";
import { fetchObs, loadObs, saveObs, type Obs } from "../api/obs";

export type ObsStatus = "henter" | "frisk" | "cached" | "fejl";

const FRESH_MS = 5 * 60_000;
let lastFetchedAt = 0;
let inFlight: Promise<Obs> | null = null;

function fetchShared(): Promise<Obs> {
  if (!inFlight) {
    inFlight = fetchObs().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

export function useObs() {
  const [obs, setObs] = useState<Obs | null>(() => loadObs());
  const [status, setStatus] = useState<ObsStatus>(() =>
    obs && Date.now() - lastFetchedAt < FRESH_MS ? "frisk" : "henter"
  );

  useEffect(() => {
    if (status === "frisk") return;
    let alive = true;
    fetchShared()
      .then((o) => {
        lastFetchedAt = Date.now();
        saveObs(o);
        if (!alive) return;
        setObs(o);
        setStatus("frisk");
      })
      .catch(() => {
        if (!alive) return;
        setStatus(loadObs() ? "cached" : "fejl");
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { obs, status };
}
