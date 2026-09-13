// HISTORIK: spot-chips, periode (default 12 mdr., foldet sammen bag én
// linje), kalender-heatmap i månedsrækker som hovedvisning, klik på en
// dag → dagens timeline, vindrose (retninger med score > 5) med
// sammenfatning, og fordeling + tærskler.
//
// Ærlighed om kilden: skærmen viser altid hvilken dato dataene reelt
// starter, og dage uden data står tomme. Intet fyldes op.

import { useEffect, useMemo, useState } from "react";
import { fetchHistory, usableCache, type HistoryData } from "../api/archive";
import { SPOTS } from "../config/spots";
import { computeStats, ROSE_THRESHOLD } from "../lib/history";
import { dateOf, fmtDateDa } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { CalendarHeatmap } from "../components/CalendarHeatmap";
import { WindRose } from "../components/WindRose";
import { ScoreDist } from "../components/ScoreDist";
import { DayTimeline } from "../components/DayTimeline";
import { loadSessions, sessionsOnDate } from "../lib/sessions";
import { Info, Legend } from "../components/Info";
import { ScreenHeader } from "../components/ScreenHeader";
import { SpotChips } from "../components/SpotChips";

function isoToday(): string {
  return dateOf(new Date().toISOString());
}

function isoMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString().slice(0, 10);
}

function HistHelp() {
  return (
    <>
      <Info q="Sådan læser du kalenderen">
        <p>
          Hvert felt er <strong>én dag</strong>, farvet efter dagens bedste time for det valgte
          spot. Rækkerne er måneder, så du ser sæsonmønsteret på ét blik: mørke striber er stille
          perioder, varme striber er perioder, hvor det var værd at køre.
        </p>
        <Legend />
        <p>
          <strong>Tryk på et felt</strong> for at se den dags 24 timer. Tomme felter med kant er
          huller i vejrarkivet, ikke dage uden bølger. Dine loggede sessions vises med ▾ i
          dags-visningen.
        </p>
      </Info>
      <Info q="Hvad viser rosen?">
        <p>
          Rosen tæller kun de timer, hvor scoren kom <strong>over {fmt(ROSE_THRESHOLD, 0)}</strong>,
          altså de gode timer, og viser, <strong>hvilken retning vinden kom fra</strong>, når det
          skete. Et langt kronblad mod fx NNV betyder: når det er godt her, er det som regel med
          vind fra NNV. Det er den, der efterprøver teorien om, at nordenvinden efter et
          NV-blæsevejr er stedets bedste opskrift.
        </p>
      </Info>
      <Info q="Hvad viser fordelingen?">
        <p>
          Søjlerne tæller, hvor mange timer i perioden der landede på hvert scoretrin (0–1, 1–2 …
          9–10). Tallet over søjlen er det ærlige antal. Søjlehøjderne er skævet, så de få gode
          timer kan ses ved siden af de mange flade.
        </p>
        <p>
          Listen nedenunder svarer på det praktiske: <strong>hvor mange dage</strong> i perioden
          nåede op over hver tærskel, fx hvor mange dage der mindst var "værd at køre".
        </p>
      </Info>
    </>
  );
}

export function HistoryScreen() {
  const [start, setStart] = useState(isoMonthsAgo(12));
  const [end, setEnd] = useState(isoToday());
  const [applied, setApplied] = useState({ start: isoMonthsAgo(12), end: isoToday() });
  const [rangeOpen, setRangeOpen] = useState(false);
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
        ? (data.areas[spot.area]?.rows ?? []).filter((r) => {
            const d = dateOf(r.time);
            return d >= applied.start && d <= applied.end;
          })
        : [],
    [data, applied, spot]
  );

  const stats = useMemo(() => computeStats(rowsInRange, spot), [rowsInRange, spot]);

  const selectedDay = selectedDate ? (stats.days.get(selectedDate) ?? null) : null;
  const coverageShort = stats.firstDataDate !== null && stats.firstDataDate > applied.start;
  const dominant = stats.roseTotal > 0 ? compass(stats.rose.indexOf(Math.max(...stats.rose)) * 22.5) : null;
  const periodLabel = `${fmtDateDa(applied.start, true)} – ${fmtDateDa(applied.end, true)}`;

  return (
    <div className="screen">
      <ScreenHeader right={loading ? "Henter arkiv …" : null} help={<HistHelp />} />

      <SpotChips value={spotId} onChange={setSpotId} />

      <button
        className={"period-btn" + (rangeOpen ? " open" : "")}
        onClick={() => setRangeOpen((o) => !o)}
        aria-expanded={rangeOpen}
      >
        <span className="k">Periode</span>
        <span>{periodLabel}</span>
      </button>
      {rangeOpen && (
        <div className="range-row">
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-label="fra" />
          <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="til" />
          <button
            className="btn"
            onClick={() => {
              setSelectedDate(null);
              setApplied({ start, end });
              setRangeOpen(false);
            }}
          >
            Hent
          </button>
        </div>
      )}

      {loading && (
        <p className="statusline">
          Henter {fmtDateDa(applied.start, true)} til {fmtDateDa(applied.end, true)} … første gang
          tager det nogle sekunder.
        </p>
      )}
      {error && (
        <div className="errorbox">
          <strong>Kunne ikke hente historikken.</strong>
          <p>{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {coverageShort && stats.firstDataDate && (
            <div className="warnbox">
              Kilden dækker først fra <strong>{fmtDateDa(stats.firstDataDate)}</strong>. Dage før
              står tomme. De er huller i arkivet, ikke dage uden bølger.
            </div>
          )}
          {stats.days.size === 0 ? (
            <p className="statusline">Ingen data i intervallet.</p>
          ) : (
            <>
              <section className="card">
                <div className="card-h">
                  <span>Dagens højeste score · {spot.shortName}</span>
                </div>
                <div className="card-body">
                  <CalendarHeatmap
                    days={stats.days}
                    start={applied.start}
                    end={applied.end}
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                  />
                </div>
              </section>

              {selectedDay && (
                <DayTimeline
                  day={selectedDay}
                  sessions={sessionsOnDate(loadSessions(), selectedDay.date)}
                />
              )}

              <section className="card">
                <div className="card-h">
                  <span>Vinden når det er godt · score over {fmt(ROSE_THRESHOLD, 0)}</span>
                </div>
                <div className="card-body">
                  {stats.roseTotal === 0 ? (
                    <p className="muted">
                      Ingen timer over {fmt(ROSE_THRESHOLD, 0)} i perioden for dette spot.
                    </p>
                  ) : (
                    <div className="rose-row">
                      <WindRose counts={stats.rose} />
                      <div className="rose-sum">
                        <strong>Oftest fra {dominant}</strong>
                        {stats.roseTotal} timer over {fmt(ROSE_THRESHOLD, 0)} i perioden.
                        Kronbladene viser, hvor vinden kom fra, når det var godt.
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="card">
                <div className="card-h">
                  <span>Fordeling af timescores</span>
                </div>
                <div className="card-body">
                  <ScoreDist bins={stats.bins} daysOver={stats.daysOver} totalDays={stats.days.size} />
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
