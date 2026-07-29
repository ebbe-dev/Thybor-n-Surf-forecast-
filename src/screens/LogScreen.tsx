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
  type Session,
  type SessionParams
} from "../lib/sessions";
import { scoreColor } from "../lib/colors";
import { fmt, compass } from "../lib/format";
import { dayName, fmtClock, dateOf } from "../lib/time";
import { Info } from "../components/Info";
import {
  calibrationEnabled,
  setCalibrationEnabled,
  correctionFor,
  MIN_SPOT_SESSIONS
} from "../lib/calibration";

// Én delvurderings-række: fem felter med endepunkts-ord.
function ParamRow({
  label,
  low,
  high,
  value,
  onChange,
  centerBest
}: {
  label: string;
  low: string;
  high: string;
  value: number; // 0 = ikke sat
  onChange: (v: number) => void;
  centerBest?: boolean;
}) {
  return (
    <div className="param">
      <div className="param-head">
        <span className="param-label">{label}</span>
        <span className="param-ends">
          {low} ↔ {high}
          {centerBest && " · 3 = perfekt"}
        </span>
      </div>
      <div className="param-btns">
        {[1, 2, 3, 4, 5].map((v) => (
          <button
            key={v}
            className={"param-btn" + (value === v ? " on" : "")}
            onClick={() => onChange(value === v ? 0 : v)}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

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
  const [size, setSize] = useState(0);
  const [shape, setShape] = useState(0);
  const [surface, setSurface] = useState(0);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [calOn, setCalOn] = useState(() => calibrationEnabled());

  const dev = useMemo(() => meanDeviation(sessions), [sessions]);

  // Aktive korrektioner til visning (afhænger af sessions + kontakten)
  const corrections = useMemo(() => {
    void sessions;
    void calOn;
    const perSpot = SPOTS.map((s) => ({ spot: s, info: correctionFor(s.id) })).filter(
      ({ info }) => info.basis === "spot"
    );
    const global = correctionFor("__global__"); // ukendt id → global fallback
    return { perSpot, global };
  }, [sessions, calOn]);

  function persist(next: Session[]) {
    setSessions(next);
    saveSessions(next);
  }

  function addSession() {
    if (rating === 0) return;
    const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];
    const timeIso = `${date}T${String(hour).padStart(2, "0")}:00`;
    const params: SessionParams = {};
    if (size > 0) params.size = size;
    if (shape > 0) params.shape = shape;
    if (surface > 0) params.surface = surface;
    const s = createSession(
      timeIso,
      spot,
      rating,
      note.trim(),
      Object.keys(params).length > 0 ? params : undefined
    );
    persist([s, ...sessions]);
    setNote("");
    setRating(0);
    setSize(0);
    setShape(0);
    setSurface(0);
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

      <label className="cal-toggle">
        <input
          type="checkbox"
          checked={calOn}
          onChange={(e) => {
            setCalibrationEnabled(e.target.checked);
            setCalOn(e.target.checked);
          }}
        />
        <span>
          <strong>Justér appens score efter mine sessions</strong>
          {calOn ? (
            corrections.perSpot.length > 0 || corrections.global.basis !== "none" ? (
              <span className="cal-status">
                {corrections.perSpot.map(({ spot, info }) => (
                  <span key={spot.id}>
                    {spot.shortName}: {info.correction >= 0 ? "+" : ""}
                    {fmt(info.correction)} ({info.n} sessions) ·{" "}
                  </span>
                ))}
                {corrections.global.basis !== "none" && (
                  <span>
                    øvrige spots: {corrections.global.correction >= 0 ? "+" : ""}
                    {fmt(corrections.global.correction)} ({corrections.global.n} sessions)
                  </span>
                )}
              </span>
            ) : (
              <span className="cal-status">ingen sessions med snapshot endnu — ingen justering</span>
            )
          ) : (
            <span className="cal-status">slået fra — appen viser modellens rå score</span>
          )}
        </span>
      </label>

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
          det.
        </p>
        <p>
          Med kontakten ovenfor slået til <strong>lærer appen af det</strong>: den lægger en
          forsigtig korrektion oven på scoren alle steder — dom, søjler, kort og kalender. Få
          sessions flytter kun lidt, flere flytter mere, og den kan aldrig flytte mere end ±2
          point. Et spot med mindst {MIN_SPOT_SESSIONS} egne sessions får sin egen korrektion;
          resten deler en fælles. Snapshots gemmes altid som modellens rå tal, så justeringen
          ikke forstærker sig selv.
        </p>
        <p>
          <strong>Delvurderingerne</strong> (valgfri) løser problemet med, at én karakter kan
          dække over modsatte fejl — 1 stjerne kan jo både være "for småt" og "kæmpe closeouts".
          STØRRELSE (3 = perfekt) tjekker modellens energiled, FORM afslører hvad bankerne gør,
          og OVERFLADE tjekker vindleddet. Når loggen er stor nok, viser de præcis hvilken del
          af modellen, der skyder forkert.
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
      <ParamRow
        label="STØRRELSE"
        low="for småt"
        high="for stort"
        centerBest
        value={size}
        onChange={setSize}
      />
      <ParamRow label="FORM" low="closeouts" high="perfekt væg" value={shape} onChange={setShape} />
      <ParamRow label="OVERFLADE" low="rodet" high="glas" value={surface} onChange={setSurface} />
      <div className="param-head">
        <span className="param-label">SAMLET</span>
        <span className="param-ends">din dom — den eneste, der SKAL sættes</span>
      </div>
      <div className="rating-row" role="radiogroup" aria-label="samlet karakter">
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
            {s.params && (
              <p className="session-params">
                {s.params.size !== undefined && <span>størrelse {s.params.size}/5</span>}
                {s.params.shape !== undefined && <span>form {s.params.shape}/5</span>}
                {s.params.surface !== undefined && <span>overflade {s.params.surface}/5</span>}
              </p>
            )}
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
