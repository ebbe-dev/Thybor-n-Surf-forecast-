// MÅLT NU: det, havet faktisk gør, ved siden af forecasten. Bøjen ved
// Fjaltring (højde, periode, retning, største bølge) og vandstanden ved
// Thyborøn Kyst, hver med sit klokkeslæt — og modellen holdt op mod bøjen
// over de sidste to døgn. Ingen af delene rører scoren.

import type { Obs } from "../api/obs";
import type { ObsStatus } from "../hooks/useObs";
import type { CachedForecast } from "../lib/storage";
import {
  BUOY_AREA,
  STALE_MIN,
  ageMin,
  buoyPeriod,
  checkForecast,
  checkVerdict,
  describeCheck,
  fmtBuoy,
  fmtObsClock,
  latestBuoy,
  latestLevel
} from "../lib/obs";
import { fmt, fmtLevel } from "../lib/format";
import { SwellChip } from "./SwellChip";

interface Props {
  obs: Obs | null;
  status: ObsStatus;
  forecast: CachedForecast | null;
  now?: number; // epoch ms — kun til test
}

export function MeasuredNow({ obs, status, forecast, now = Date.now() }: Props) {
  if (!obs) {
    return (
      <section className="card measured" aria-label="målt nu">
        <div className="card-h">
          <span>Målt nu</span>
          <span className="card-h-hint">
            {status === "henter" ? "henter målinger …" : "målingerne kunne ikke hentes"}
          </span>
        </div>
      </section>
    );
  }
  const buoy = latestBuoy(obs);
  const level = latestLevel(obs);
  const check = checkForecast(forecast?.areas[BUOY_AREA]?.rows ?? [], obs.buoy?.rows, now);
  const stale = (iso: string) => ageMin(iso, now) > STALE_MIN;
  const fetchedAge = ageMin(obs.fetchedAt, now);
  const hint =
    status === "cached"
      ? `offline · hentet ${fmtObsClock(obs.fetchedAt, new Date(now))}`
      : fetchedAge > STALE_MIN
        ? `hentet ${fmtObsClock(obs.fetchedAt, new Date(now))}`
        : "hver halve time";

  return (
    <section className="card measured" aria-label="målt nu">
      <div className="card-h">
        <span>Målt nu</span>
        <span className="card-h-hint">{hint}</span>
      </div>
      <div className="meas-body">
        <div className="meas-row">
          <div className="meas-lab">Bøje Fjaltring</div>
          {buoy ? (
            <div className="meas-val">
              {buoyPeriod(buoy)?.kind === "top" && <SwellChip tp={buoyPeriod(buoy)!.s} />}
              <strong>{fmtBuoy(buoy)}</strong>
              {buoy.hmax != null && <span className="meas-sub">største {fmt(buoy.hmax)} m</span>}
              <span className={"meas-when" + (stale(buoy.time) ? " stale" : "")}>
                {fmtObsClock(buoy.time, new Date(now))}
                {stale(buoy.time) && " · gammel"}
              </span>
            </div>
          ) : (
            <div className="meas-val muted">ikke målt — bøjen svarer tomt</div>
          )}
        </div>
        <div className="meas-row">
          <div className="meas-lab">Vandstand {obs.level?.name ?? "Thyborøn Kyst"}</div>
          {level ? (
            <div className="meas-val">
              <strong>{fmtLevel(level.m, 2)}</strong>
              <span className="meas-sub">ift. middel</span>
              <span className={"meas-when" + (stale(level.time) ? " stale" : "")}>
                {fmtObsClock(level.time, new Date(now))}
                {stale(level.time) && " · gammel"}
              </span>
            </div>
          ) : (
            <div className="meas-val muted">ikke målt</div>
          )}
        </div>
        <div className="meas-check">
          {check ? (
            <>
              <span className="meas-lab">Modellen mod bøjen</span>{" "}
              <strong>
                {checkVerdict(check) === "tæt på"
                  ? "tæt på bøjen"
                  : `${checkVerdict(check)} bøjen`}
              </strong>
              : {describeCheck(check)}
            </>
          ) : buoy ? (
            <span className="muted">Modellen mod bøjen: for få målinger med en forecast-time endnu</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
