// Timeline for én valgt dag: 24 timesøjler i scorefarver.
// Loggede sessions markeres her, når loggen (etape 4) er i drift.

import type { DayStat } from "../lib/history";
import { hoursOfDay } from "../lib/history";
import { scoreColor } from "../lib/colors";
import { dayName, fmtClock } from "../lib/time";
import { fmt, compass } from "../lib/format";

export function DayTimeline({ day }: { day: DayStat }) {
  const hours = hoursOfDay(day);
  const best = day.hours.find((h) => h.time === day.bestTime);
  return (
    <section className="daytimeline">
      <header className="detail-head">
        <span>
          {dayName(day.date + "T12:00")} {Number(day.date.slice(8, 10))}/{Number(day.date.slice(5, 7))}{" "}
          {day.date.slice(0, 4)}
        </span>
        <span className="detail-score" style={{ color: scoreColor(day.max) }}>
          {fmt(day.max)}
        </span>
      </header>
      {best && (
        <p className="daytimeline-best">
          Bedst kl. {fmtClock(best.time)}: {fmt(best.row.hs)} m / {fmt(best.row.tp)} s ·{" "}
          {compass(best.row.swdir)}-bølge · vind {compass(best.row.wdir)} {fmt(best.row.wspd)} m/s{" "}
          <span className={"src-badge " + best.row.source}>{best.row.source}</span>
        </p>
      )}
      <svg viewBox="0 0 340 84" className="daytimeline-svg" aria-label="dagens timer">
        {hours.map((h, i) => {
          const x = 4 + i * 14;
          if (!h)
            return (
              <rect key={i} x={x} y={66} width={11} height={2} fill="none" stroke="#22332F" strokeWidth="0.7" />
            );
          const bar = Math.max(2, (h.score / 10) * 62);
          return (
            <rect key={i} x={x} y={68 - bar} width={11} height={bar} fill={scoreColor(h.score)} />
          );
        })}
        {[0, 6, 12, 18].map((t) => (
          <text key={t} x={4 + t * 14} y={80} fontSize="8" fill="#6F847F">
            {String(t).padStart(2, "0")}
          </text>
        ))}
      </svg>
      <p className="muted daytimeline-note">Loggede sessions markeres her fra etape 4.</p>
    </section>
  );
}
