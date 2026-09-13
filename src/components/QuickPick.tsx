// Den superenkle forside-liste: alle spots rangeret efter deres bedste
// dagslys-vindue de næste 2 døgn. Bedste spot grønt, dårligste rødt —
// det er en RANGERING (hvis du skal ud, hvor så?); selve score-tallet
// beholder appens faste farveskala, så tallene aldrig lyver.
// Selve rangeringen bor i lib/blocks.ts (rankSpots) og deles med dommen.

import { useMemo } from "react";
import type { CachedForecast } from "../lib/storage";
import { SPOTS } from "../config/spots";
import { rankSpots } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { fmtClock, relativeDayLabel, todayIso } from "../lib/time";
import { fmt } from "../lib/format";
import { sunTimes, fmtSunHour } from "../lib/sun";

export function QuickPick({ forecast }: { forecast: CachedForecast }) {
  const entries = useMemo(() => rankSpots(forecast, SPOTS), [forecast]);

  if (entries.length === 0) return null;

  const today = todayIso();
  const st = sunTimes(today, SPOTS[0].lat, SPOTS[0].lon);
  const sunLine =
    typeof st === "object" ? `sol ${fmtSunHour(st.sunrise)}–${fmtSunHour(st.sunset)}` : null;

  return (
    <section className="qp">
      <h3 className="section-h">
        Næste 2 døgn — hvor og hvornår
        {sunLine && <span className="muted"> · {sunLine}</span>}
      </h3>
      {entries.map(({ spot, block }, i) => {
        const cls =
          "qp-row" +
          (i === 0 ? " best" : "") +
          (i === entries.length - 1 && entries.length > 1 ? " worst" : "");
        return (
          <div className={cls} key={spot.id}>
            <span className="qp-name">
              {spot.shortName}
              {spot.uncalibrated && <span className="uncal-inline"> ukal.</span>}
            </span>
            <span className="qp-when">
              {relativeDayLabel(block.time, today)} kl. {fmtClock(block.time)}
            </span>
            <span className="qp-score" style={{ color: scoreColor(block.score) }}>
              {fmt(block.score)}
            </span>
          </div>
        );
      })}
    </section>
  );
}
