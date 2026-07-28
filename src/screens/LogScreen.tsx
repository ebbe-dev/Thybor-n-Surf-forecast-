// LOG: sessions med dato, spot, karakter 1–5, note og snapshot af de
// forhold modellen forudsagde. Løbende afvigelse (karakter × 2 vs. score)
// øverst. Lokal lagring + CSV/JSON-eksport som backup.

import { useMemo, useState } from "react";
import { SPOTS } from "../config/spots";
import {
  createSession,
  download,
  loadSessions,
  meanDeviation,
  saveSessions,
  toCsv,
  type Session
} from "../lib/sessions";
import { scoreColor } from "../lib/colors";
import { fmt, compass } from "../lib/format";
import { dayName, fmtClock, dateOf } from "../lib/time";
import { Info } from "../components/Info";

function nowLocal(): { date: string; hour: number } {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    hour: d.getHours()
  };
}

export function LogScreen() {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const init = nowLocal();
  const [date, setDate] = useState(init.date);
  const [hour, setHour] = useState(init.hour);
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [rating, setRating] = useState<Session["rating"] | 0>(0);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);

  const dev = useMemo(() => meanDeviation(sessions), [sessions]);

  function persist(next: Session[]) {
    setSessions(next);
    saveSessions(next);
  }

  function addSession() {
    if (rating === 0) return;
    const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];
    const timeIso = `${date}T${String(hour).padStart(2, "0")}:00`;
    const s = createSession(timeIso, spot, rating, note.trim());
    persist([s, ...sessions]);
    setNote("");
    setRating(0);
    setConfirm(
      s.predicted === null
        ? "Gemt — men ingen forecast-data for tidspunktet, så snapshot mangler."
        : "Gemt."
    );
    setTimeout(() => setConfirm(null), 4000);
  }

  return (
    <div className="screen">
      {dev && (
        <section className="dev-box">
          <span className="dev-label">Din karakter ×2 minus modellens score, snit af {dev.n}:</span>
          <span className="dev-value">
            {dev.mean >= 0 ? "+" : ""}
            {fmt(dev.mean)}
          </span>
        </section>
      )}

      <Info q="Hvorfor logge — og hvad betyder tallet øverst?">
        <p>
          Hver gang du gemmer en session, gemmer appen samtidig et <strong>snapshot</strong> af
          de forhold, modellen forudsagde for tidspunktet — og modellens score. Så kan vi
          bagefter sammenligne, hvad modellen <em>troede</em>, med hvad du <em>oplevede</em>.
        </p>
        <p>
          Tallet øverst er den sammenligning: dine stjerner ganget med 2 (så 5★ = 10, samme
          skala som scoren) minus modellens score, i snit. <strong>Minus</strong> betyder, at
          modellen lover mere, end stedet holder; <strong>plus</strong>, at den undervurderer
          det. Når du har logget en håndfuld sessions, bruger vi tallet til at justere modellen.
        </p>
        <p>
          Loggen ligger <strong>kun på denne telefon</strong>. CSV-knappen gemmer en
          regnearksfil som backup — gør det i ny og næ.
        </p>
      </Info>

      <h3 className="section-h">Ny session</h3>
      <div className="range-row">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="dato" />
        <select value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="klokkeslæt">
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              kl. {String(h).padStart(2, "0")}
            </option>
          ))}
        </select>
      </div>
      <div className="spot-tabs">
        {SPOTS.map((s) => (
          <button
            key={s.id}
            className={"spot-tab" + (s.id === spotId ? " active" : "")}
            onClick={() => setSpotId(s.id)}
          >
            {s.shortName}
          </button>
        ))}
      </div>
      <div className="rating-row" role="radiogroup" aria-label="karakter">
        {([1, 2, 3, 4, 5] as const).map((r) => (
          <button
            key={r}
            className={"rating-btn" + (rating >= r ? " on" : "")}
            onClick={() => setRating(r)}
            role="radio"
            aria-checked={rating === r}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="note-input"
        placeholder="Note (valgfri) — bølge, bræt, hvem du var afsted med …"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
      />
      <button className="btn btn-wide" onClick={addSession} disabled={rating === 0}>
        GEM SESSION
      </button>
      {confirm && <p className="statusline">{confirm}</p>}

      <h3 className="section-h">
        {sessions.length} sessions
        {sessions.length > 0 && (
          <span className="export-links">
            <button className="linkbtn" onClick={() => download("byg-tangen-log.csv", toCsv(sessions), "text/csv")}>
              CSV
            </button>
            <button
              className="linkbtn"
              onClick={() => download("byg-tangen-log.json", JSON.stringify(sessions, null, 2), "application/json")}
            >
              JSON
            </button>
          </span>
        )}
      </h3>
      {sessions.length === 0 && (
        <p className="statusline">
          Ingen sessions endnu. Loggen bor kun på denne telefon — tag en CSV-backup i ny og næ.
        </p>
      )}
      {sessions.map((s) => {
        const spot = SPOTS.find((x) => x.id === s.spotId);
        return (
          <article className="session" key={s.id}>
            <header className="session-head">
              <span>
                <strong>
                  {dayName(s.time, true)} {Number(s.time.slice(8, 10))}/{Number(s.time.slice(5, 7))}{" "}
                  {s.time.slice(0, 4)}
                </strong>{" "}
                kl. {fmtClock(s.time)} · {spot?.shortName ?? s.spotId}
              </span>
              <span className="session-stars">{"★".repeat(s.rating)}</span>
            </header>
            {s.note && <p className="session-note">{s.note}</p>}
            <p className="session-snap">
              {s.snapshot ? (
                <>
                  {fmt(s.snapshot.hs)} m / {fmt(s.snapshot.tp)} s · {compass(s.snapshot.swdir)}-bølge · vind{" "}
                  {compass(s.snapshot.wdir)} {fmt(s.snapshot.wspd)} m/s · model{" "}
                  <strong style={{ color: scoreColor(s.predicted ?? 0) }}>{fmt(s.predicted ?? 0)}</strong>
                </>
              ) : (
                <span className="muted">intet forecast-snapshot for tidspunktet</span>
              )}
            </p>
            <button
              className="linkbtn session-del"
              onClick={() => {
                if (window.confirm(`Slet sessionen ${dateOf(s.time)}?`)) {
                  persist(sessions.filter((x) => x.id !== s.id));
                }
              }}
            >
              slet
            </button>
          </article>
        );
      })}
    </div>
  );
}
