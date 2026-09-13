// LOG: handlingen først — ny session (dato, spot, delvurderinger, samlet
// karakter, note), dernæst listen af sessions, og nederst kalibreringen
// (afvigelse + kontakten). Løbende afvigelse (karakter vs. modellens score)
// og et snapshot af de forhold modellen forudsagde gemmes pr. session.
// Lokal lagring + CSV/JSON-eksport som backup.

import { useMemo, useState } from "react";
import { SPOTS } from "../config/spots";
import {
  createSession,
  updateSession,
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
import { dayName, fmtClock, fmtDateDa } from "../lib/time";
import { Info } from "../components/Info";
import { ScreenHeader } from "../components/ScreenHeader";
import { SpotChips } from "../components/SpotChips";
import { ScorePill } from "../components/ScorePill";
import {
  calibrationEnabled,
  setCalibrationEnabled,
  correctionFor,
  MIN_SPOT_SESSIONS
} from "../lib/calibration";

// Én delvurderings-række: 0–10-skyder med halve trin. -1 = ikke sat, og
// så ser skyderen også uindstillet ud.
function ParamRow({
  label,
  ends,
  value,
  onChange
}: {
  label: string;
  ends: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const unset = value < 0;
  return (
    <div className="param">
      <div className="param-head">
        <span className="param-label">{label}</span>
        <span className="param-ends">{ends}</span>
      </div>
      <div className="rate-row">
        <input
          type="range"
          className={unset ? "unset" : ""}
          min={0}
          max={10}
          step={0.5}
          value={unset ? 5 : value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
        />
        <span className={"rate-value" + (unset ? " unset" : "")}>{unset ? "–" : fmt(value)}</span>
        <button
          className="param-clear"
          onClick={() => onChange(-1)}
          disabled={unset}
          aria-label={"nulstil " + label}
        >
          ×
        </button>
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

function LogHelp() {
  return (
    <>
      <Info q="Hvorfor logge?">
        <p>
          Hver gang du gemmer en session, gemmer appen samtidig et <strong>snapshot</strong> af
          de forhold, modellen forudsagde for tidspunktet, og modellens score. Så kan vi bagefter
          sammenligne, hvad modellen <em>troede</em>, med hvad du <em>oplevede</em>.
        </p>
        <p>
          <strong>Delvurderingerne</strong> (valgfri, 0–10) løser problemet med, at én karakter
          kan dække over modsatte fejl. En lav karakter kan jo både være "for småt" og "kæmpe
          closeouts". STØRRELSE (5 = perfekt) tjekker modellens energiled, FORM afslører hvad
          bankerne gør, og OVERFLADE tjekker vindleddet. Når loggen er stor nok, viser de præcis
          hvilken del af modellen, der skyder forkert. ×-knappen nulstiller en delvurdering, du
          ikke vil sætte.
        </p>
        <p>
          Loggen ligger <strong>kun på denne telefon</strong>. CSV-knappen gemmer en
          regnearksfil som backup. Gør det i ny og næ.
        </p>
      </Info>
      <Info q="Hvad betyder kalibreringen?">
        <p>
          Tallet under Kalibrering er din karakter minus modellens score, i snit. Begge er på
          samme 0–10-skala, så de kan sammenlignes direkte. <strong>Minus</strong> betyder, at
          modellen lover mere, end stedet holder; <strong>plus</strong>, at den undervurderer det.
        </p>
        <p>
          Med kontakten slået til <strong>lærer appen af det</strong>: den lægger en forsigtig
          korrektion oven på scoren alle steder, dom, søjler, kort og kalender. Få sessions flytter
          kun lidt, flere flytter mere, og den kan aldrig flytte mere end ±2 point. Et spot med
          mindst {MIN_SPOT_SESSIONS} egne sessions får sin egen korrektion; resten deler en fælles.
          Snapshots gemmes altid som modellens rå tal, så justeringen ikke forstærker sig selv.
        </p>
      </Info>
    </>
  );
}

export function LogScreen() {
  const [sessions, setSessions] = useState<Session[]>(() => loadSessions());
  const init = nowLocal();
  const [date, setDate] = useState(init.date);
  const [hour, setHour] = useState(init.hour);
  // Nyt spot-valg starter på det spot, du sidst loggede.
  const [spotId, setSpotId] = useState(
    () => SPOTS.find((s) => s.id === loadSessions()[0]?.spotId)?.id ?? SPOTS[0].id
  );
  const [rating, setRating] = useState(-1); // -1 = ikke sat, ellers 0–10
  const [size, setSize] = useState(-1);
  const [shape, setShape] = useState(-1);
  const [surface, setSurface] = useState(-1);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function clearForm() {
    setNote("");
    setRating(-1);
    setSize(-1);
    setShape(-1);
    setSurface(-1);
    setEditingId(null);
  }

  function startEdit(s: Session) {
    setEditingId(s.id);
    setDate(s.time.slice(0, 10));
    setHour(Number(s.time.slice(11, 13)));
    setSpotId(SPOTS.some((x) => x.id === s.spotId) ? s.spotId : SPOTS[0].id);
    setRating(s.rating);
    setSize(s.params?.size ?? -1);
    setShape(s.params?.shape ?? -1);
    setSurface(s.params?.surface ?? -1);
    setNote(s.note);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addSession() {
    if (rating < 0) return;
    const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];
    const timeIso = `${date}T${String(hour).padStart(2, "0")}:00`;
    const params: SessionParams = {};
    if (size >= 0) params.size = size;
    if (shape >= 0) params.shape = shape;
    if (surface >= 0) params.surface = surface;
    const p = Object.keys(params).length > 0 ? params : undefined;

    const wasEditing = editingId !== null;
    let saved: Session;
    if (editingId) {
      const orig = sessions.find((s) => s.id === editingId);
      if (!orig) return;
      saved = updateSession(orig, timeIso, spot, rating, note.trim(), p);
      persist(sessions.map((s) => (s.id === editingId ? saved : s)));
    } else {
      saved = createSession(timeIso, spot, rating, note.trim(), p);
      persist([saved, ...sessions]);
    }
    clearForm();
    setConfirm(
      saved.predicted === null
        ? "Gemt, men der er ingen forecast-data for tidspunktet, så snapshot mangler."
        : wasEditing
          ? "Rettelse gemt."
          : "Gemt."
    );
    setTimeout(() => setConfirm(null), 4000);
  }

  const ratingUnset = rating < 0;

  return (
    <div className="screen">
      <ScreenHeader
        right={`${sessions.length} ${sessions.length === 1 ? "session" : "sessions"}`}
        help={<LogHelp />}
      />

      <section className="card">
        <div className="card-h">
          <span>{editingId ? "Ret session" : "Ny session"}</span>
          {editingId && (
            <button className="linkbtn" onClick={clearForm}>
              annullér
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="field-row">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="dato" />
            <select value={hour} onChange={(e) => setHour(Number(e.target.value))} aria-label="klokkeslæt">
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  kl. {String(h).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <SpotChips value={spotId} onChange={setSpotId} />
          <ParamRow
            label="STØRRELSE"
            ends="0 = for småt · 5 = perfekt · 10 = for stort"
            value={size}
            onChange={setSize}
          />
          <ParamRow label="FORM" ends="0 = closeouts · 10 = perfekt væg" value={shape} onChange={setShape} />
          <ParamRow label="OVERFLADE" ends="0 = rodet · 10 = glas" value={surface} onChange={setSurface} />
          <div className="param">
            <div className="param-head">
              <span className="param-label">SAMLET</span>
              <span className="param-ends">0–10, samme skala som appens score</span>
            </div>
            <div className="rate-row">
              <input
                type="range"
                className={ratingUnset ? "unset" : ""}
                min={0}
                max={10}
                step={0.5}
                value={ratingUnset ? 5 : rating}
                onChange={(e) => setRating(Number(e.target.value))}
                aria-label="samlet karakter 0-10"
              />
              <span
                className={"rate-value" + (ratingUnset ? " unset" : "")}
                style={ratingUnset ? undefined : { color: scoreColor(rating) }}
              >
                {ratingUnset ? "–" : fmt(rating)}
              </span>
            </div>
          </div>
          <textarea
            className="note-input"
            placeholder="Note (valgfri): bølge, bræt, hvem du var afsted med …"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
          />
          <button className="btn btn-wide" onClick={addSession} disabled={ratingUnset}>
            {editingId ? "Gem rettelse" : "Gem session"}
          </button>
          {ratingUnset && (
            <p className="form-note">Sæt den samlede karakter for at gemme. Delvurderingerne er valgfri.</p>
          )}
          {confirm && <p className="form-note">{confirm}</p>}
        </div>
      </section>

      <section className="card">
        <div className="card-h">
          <span>
            {sessions.length} {sessions.length === 1 ? "session" : "sessions"}
          </span>
          {sessions.length > 0 && (
            <span className="export-links">
              <button
                className="btn-ghost btn-sm"
                onClick={() => download("byg-tangen-log.csv", toCsv(sessions), "text/csv")}
              >
                CSV
              </button>
              <button
                className="btn-ghost btn-sm"
                onClick={() =>
                  download("byg-tangen-log.json", JSON.stringify(sessions, null, 2), "application/json")
                }
              >
                JSON
              </button>
            </span>
          )}
        </div>
        {sessions.length === 0 && (
          <p className="statusline" style={{ padding: "0 14px 14px" }}>
            Ingen sessions endnu. Loggen bor kun på denne telefon, så tag en CSV-backup i ny og
            næ.
          </p>
        )}
        {sessions.map((s) => {
          const spot = SPOTS.find((x) => x.id === s.spotId);
          return (
            <article className="session" key={s.id}>
              <header className="session-head">
                <span className="when">
                  <strong>
                    {dayName(s.time, true)} {fmtDateDa(s.time, true)}
                  </strong>{" "}
                  kl. {fmtClock(s.time)} · {spot?.shortName ?? s.spotId}
                </span>
                <ScorePill score={s.rating} />
              </header>
              {s.params && (
                <p className="session-params">
                  {s.params.size !== undefined && <span>størrelse {fmt(s.params.size)}</span>}
                  {s.params.shape !== undefined && <span>form {fmt(s.params.shape)}</span>}
                  {s.params.surface !== undefined && <span>overflade {fmt(s.params.surface)}</span>}
                </p>
              )}
              {s.note && <p className="session-note">{s.note}</p>}
              <p className="session-snap">
                {s.snapshot ? (
                  <>
                    {fmt(s.snapshot.hs)} m / {fmt(s.snapshot.tp)} s · {compass(s.snapshot.swdir)}-bølge ·
                    vind {compass(s.snapshot.wdir)} {fmt(s.snapshot.wspd)} m/s · model{" "}
                    <strong style={{ color: scoreColor(s.predicted ?? 0) }}>{fmt(s.predicted ?? 0)}</strong>
                  </>
                ) : (
                  <span className="muted">intet forecast-snapshot for tidspunktet</span>
                )}
              </p>
              <div className="session-actions">
                <button className="btn-ghost btn-sm" onClick={() => startEdit(s)}>
                  Ret
                </button>
                <button
                  className="btn-ghost btn-sm"
                  onClick={() => {
                    if (window.confirm(`Slet sessionen ${fmtDateDa(s.time, true)}?`)) {
                      persist(sessions.filter((x) => x.id !== s.id));
                    }
                  }}
                >
                  Slet
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <section className="card">
        <div className="card-h">
          <span>Kalibrering</span>
        </div>
        {dev ? (
          <div className="dev-row">
            <span className="dev-label">
              Din karakter minus modellens score, snit af {dev.n}{" "}
              {dev.n === 1 ? "session" : "sessions"}
            </span>
            <span className="dev-value">
              {dev.mean >= 0 ? "+" : ""}
              {fmt(dev.mean)}
            </span>
          </div>
        ) : (
          <p className="statusline" style={{ padding: "0 14px 10px" }}>
            Ingen sessions med snapshot endnu, så der er ikke noget at kalibrere efter.
          </p>
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
                <span className="cal-status">ingen sessions med snapshot endnu, ingen justering</span>
              )
            ) : (
              <span className="cal-status">slået fra, appen viser modellens rå score</span>
            )}
          </span>
        </label>
      </section>
    </div>
  );
}
