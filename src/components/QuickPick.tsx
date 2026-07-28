// Den superenkle forside-liste: alle spots rangeret efter deres bedste
// dagslys-vindue de næste 2 døgn. Bedste spot grønt, dårligste rødt —
// det er en RANGERING (hvis du skal ud, hvor så?); selve score-tallet
// beholder appens faste farveskala, så tallene aldrig lyver.

import { useMemo } from "react";
import type { CachedForecast } from "../lib/storage";
import { SPOTS, type Spot } from "../config/spots";
import { buildDays, nowLocalIso, isDaylightBlock, type Block } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { dateOf, fmtClock } from "../lib/time";
import { fmt } from "../lib/format";
import { sunTimes, fmtSunHour } from "../lib/sun";

interface Entry {
  spot: Spot;
  best: Block;
}

function nextDate(date: string): string {
  const d = new Date(date + "T12:00");
  d.setDate(d.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function QuickPick({ forecast }: { forecast: CachedForecast }) {
  const entries = useMemo<Entry[]>(() => {
    const now = nowLocalIso();
    const today = dateOf(now);
    const tomorrow = nextDate(today);
    const list: Entry[] = [];
    for (const spot of SPOTS) {
      let best: Block | null = null;
      for (const day of buildDays(forecast, spot)) {
        if (day.date !== today && day.date !== tomorrow) continue;
        for (const b of day.blocks) {
          if (!b || b.time < now) continue;
          if (!isDaylightBlock(b.time, spot)) continue;
          if (!best || b.score > best.score) best = b;
        }
      }
      if (best) list.push({ spot, best });
    }
    return list.sort((a, b) => b.best.score - a.best.score);
  }, [forecast]);

  if (entries.length === 0) return null;

  const today = dateOf(nowLocalIso());
  const st = sunTimes(today, SPOTS[0].lat, SPOTS[0].lon);
  const sunLine =
    typeof st === "object" ? `sol ${fmtSunHour(st.sunrise)}–${fmtSunHour(st.sunset)}` : null;

  return (
    <section className="qp">
      <h3 className="section-h">
        Næste 2 døgn — hvor og hvornår
        {sunLine && <span className="muted"> · {sunLine}</span>}
      </h3>
      {entries.map(({ spot, best }, i) => {
        const cls =
          "qp-row" +
          (i === 0 ? " best" : "") +
          (i === entries.length - 1 && entries.length > 1 ? " worst" : "");
        const dayLabel = dateOf(best.time) === today ? "i dag" : "i morgen";
        return (
          <div className={cls} key={spot.id}>
            <span className="qp-name">
              {spot.shortName}
              {spot.uncalibrated && <span className="uncal-inline"> ukal.</span>}
            </span>
            <span className="qp-when">
              {dayLabel} kl. {fmtClock(best.time)}
            </span>
            <span className="qp-score" style={{ color: scoreColor(best.score) }}>
              {fmt(best.score)}
            </span>
          </div>
        );
      })}
    </section>
  );
}
