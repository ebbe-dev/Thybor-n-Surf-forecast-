// HISTORIK: datointerval (default 12 mdr.), kalender-heatmap som
// hovedvisning, vindrose (retninger med score > 5), fordeling + tærskler,
// og klik på en dag → dagens timeline.
//
// Ærlighed om kilden: skærmen viser altid hvilken dato dataene reelt
// starter, og dage uden data står tomme. Intet fyldes op.

import { useEffect, useMemo, useState } from "react";
import { fetchHistory, usableCache, type HistoryData } from "../api/archive";
import { SPOTS } from "../config/spots";
import { computeStats, ROSE_THRESHOLD } from "../lib/history";
import { dateOf } from "../lib/time";
import { fmt } from "../lib/format";
import { CalendarHeatmap } from "../components/CalendarHeatmap";
import { WindRose } from "../components/WindRose";
import { ScoreDist } from "../components/ScoreDist";
import { DayTimeline } from "../components/DayTimeline";
import { loadSessions, sessionsOnDate } from "../lib/sessions";

function isoToday(): string {
  return dateOf(new Date().toISOString());
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

export function HistoryScreen() {
  const [start, setStart] = useState(isoMonthsAgo(12));
  const [end, setEnd] = useState(isoToday());
  const [applied, setApplied] = useState({ start: isoMonthsAgo(12), end: isoToday() });
  const [data, setData] = useState<HistoryData | null>(() => usableCache(isoMonthsAgo(12), isoToday()));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];

  useEffect(() => {
    let alive = true;
    if (data && data.start <= applied.start && data.end >= applied.end) return;
    setLoading(true);
    setError(null);
    fetchHistory(applied.start, applied.end)
      .then((h) => {
        if (!alive) return;
        setData(h);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [applied, data]);

  const rowsInRange = useMemo(
    () =>
      data
        ? data.rows.filter((r) => {
            const d = dateOf(r.time);
            return d >= applied.start && d <= applied.end;
          })
        : [],
    [data, applied]
  );

  const stats = useMemo(() => computeStats(rowsInRange, spot), [rowsInRange, spot]);

  const selectedDay = selectedDate ? (stats.days.get(selectedDate) ?? null) : null;
  const coverageShort =
    stats.firstDataDate !== null && stats.firstDataDate > applied.start;

  return (
    <div className="screen">
      <div className="range-row">
        <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="fra" />
        <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="til" />
        <button
          className="btn"
          onClick={() => {
            setSelectedDate(null);
            setApplied({ start, end });
          }}
        >
          Hent
        </button>
      </div>

      <div className="spot-tabs">
        {SPOTS.map((s) => (
          <button
            key={s.id}
            className={"spot-tab" + (s.id === spotId ? " active" : "")}
            onClick={() => setSpotId(s.id)}
          >
            {s.shortName}
            {s.uncalibrated && <span className="uncal">ukalibreret</span>}
          </button>
        ))}
      </div>

      {loading && <p className="statusline">Henter {applied.start} → {applied.end} … første gang tager det nogle sekunder.</p>}
      {error && (
        <div className="errorbox">
          <strong>Kunne ikke hente historikken.</strong>
          <p>{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {coverageShort && (
            <div className="warnbox">
              Kilden dækker først fra <strong>{stats.firstDataDate}</strong> — dage før står tomme.
              De er huller i arkivet, ikke dage uden bølger.
            </div>
          )}
          {stats.days.size === 0 ? (
            <p className="statusline">Ingen data i intervallet.</p>
          ) : (
            <>
              <h3 className="section-h">Dagens højeste score</h3>
              <CalendarHeatmap
                days={stats.days}
                start={applied.start}
                end={applied.end}
                selected={selectedDate}
                onSelect={setSelectedDate}
              />

              {selectedDay && (
                <DayTimeline
                  day={selectedDay}
                  sessions={sessionsOnDate(loadSessions(), selectedDay.date)}
                />
              )}

              <h3 className="section-h">
                Vindretninger med score over {fmt(ROSE_THRESHOLD, 0)}
                <span className="muted"> · {stats.roseTotal} timer</span>
              </h3>
              {stats.roseTotal === 0 ? (
                <p className="statusline">Ingen timer over {fmt(ROSE_THRESHOLD, 0)} i perioden for dette spot.</p>
              ) : (
                <WindRose counts={stats.rose} />
              )}

              <h3 className="section-h">Fordeling af timescores</h3>
              <ScoreDist bins={stats.bins} daysOver={stats.daysOver} totalDays={stats.days.size} />
            </>
          )}
        </>
      )}
    </div>
  );
}
