// Timeline for én valgt dag: 24 timesøjler i scorefarver, med loggede
// sessions markeret som ★ over timen.

import type { DayStat } from "../lib/history";
import { hoursOfDay } from "../lib/history";
import { scoreColor, FG } from "../lib/colors";
import { dayName, fmtClock, hourOf } from "../lib/time";
import { fmt, compass } from "../lib/format";
import type { Session } from "../lib/sessions";

export function DayTimeline({ day, sessions = [] }: { day: DayStat; sessions?: Session[] }) {
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
        {sessions.map((s) => (
          <text
            key={s.id}
            x={4 + hourOf(s.time) * 14 + 5.5}
            y={8}
            fontSize="9"
            fontWeight="700"
            fill={FG}
            textAnchor="middle"
          >
            ★{s.rating}
          </text>
        ))}
      </svg>
      {sessions.length > 0 && (
        <p className="muted daytimeline-note">
          ★ = logget session med din karakter. Detaljer under LOG.
        </p>
      )}
    </section>
  );
}
