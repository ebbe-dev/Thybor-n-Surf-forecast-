// NU: dommen øverst, 7-døgns barograf i 3-timers blokke, tryk på en
// søjle → tal + høfde-planview der roterer med vinden.

import { useMemo, useState } from "react";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, effectiveNormal, setNormal, type Spot } from "../config/spots";
import { buildDays, pickVerdict, nowLocalIso, type Block } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { dayName, fmtClock } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { Verdict } from "../components/Verdict";
import { Barograph } from "../components/Barograph";
import { GroynePlan } from "../components/GroynePlan";

function fmtFetched(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NormalSetting({ spot, onChange }: { spot: Spot; onChange: () => void }) {
  const [val, setVal] = useState(String(effectiveNormal(spot)));
  return (
    <div className="normal-setting">
      <label htmlFor="normal-input">
        Mundingens retning (grader) — <strong>UKALIBRERET</strong>, default er et gæt
      </label>
      <div className="normal-row">
        <input
          id="normal-input"
          type="number"
          inputMode="numeric"
          min={0}
          max={359}
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button
          className="btn"
          onClick={() => {
            const n = Number(val);
            if (Number.isFinite(n)) {
              setNormal(spot, n);
              onChange();
            }
          }}
        >
          Gem
        </button>
      </div>
    </div>
  );
}

function BlockDetail({ block, spot }: { block: Block; spot: Spot }) {
  const r = block.row;
  const color = scoreColor(block.score);
  return (
    <section className="detail">
      <header className="detail-head">
        <span>
          {dayName(block.time)} kl. {fmtClock(block.time)} · {spot.shortName}
        </span>
        <span className="detail-score" style={{ color }}>
          {fmt(block.score)}
        </span>
      </header>
      <dl className="detail-grid">
        <div>
          <dt>Bølge</dt>
          <dd>
            {fmt(r.hs)} m <span className={"src-badge " + r.source}>{r.source}</span>
          </dd>
        </div>
        <div>
          <dt>Periode</dt>
          <dd>{fmt(r.tp)} s</dd>
        </div>
        <div>
          <dt>Bølgeretning</dt>
          <dd>
            {compass(r.swdir)} {Math.round(r.swdir)}°
          </dd>
        </div>
        <div>
          <dt>Vind</dt>
          <dd>
            {compass(r.wdir)} {fmt(r.wspd)} m/s
          </dd>
        </div>
        <div>
          <dt>Stød</dt>
          <dd>{fmt(r.gust)} m/s</dd>
        </div>
        <div>
          <dt>Luft</dt>
          <dd>{r.temp == null ? "—" : fmt(r.temp) + " °C"}</dd>
        </div>
      </dl>
      <GroynePlan
        normal={effectiveNormal(spot)}
        wdir={r.wdir}
        wspd={r.wspd}
        side={block.side}
      />
    </section>
  );
}

export function NowScreen() {
  const { forecast, status, error } = useForecast();
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [normalVersion, setNormalVersion] = useState(0);

  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];

  const days = useMemo(
    () => (forecast ? buildDays(forecast, spot) : []),
    [forecast, spot, normalVersion]
  );
  const verdict = useMemo(
    () => (forecast ? pickVerdict(forecast, SPOTS) : null),
    [forecast, normalVersion]
  );

  // Default-valg: første kommende blok for det valgte spot.
  const selected: Block | null = useMemo(() => {
    const all = days.flatMap((d) => d.blocks).filter((b): b is Block => b !== null);
    if (selectedTime) {
      const hit = all.find((b) => b.time === selectedTime);
      if (hit) return hit;
    }
    const now = nowLocalIso();
    return all.find((b) => b.time >= now) ?? all[all.length - 1] ?? null;
  }, [days, selectedTime]);

  if (!forecast) {
    return (
      <div className="screen">
        <p className="statusline">{status === "henter" ? "Henter forecast …" : ""}</p>
        {status === "fejl" && (
          <div className="errorbox">
            <strong>Ingen forecast.</strong>
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <p className="statusline">
        {status === "cached" ? (
          <strong>OFFLINE — viser forecast hentet {fmtFetched(forecast.fetchedAt)}</strong>
        ) : (
          <>hentet {fmtFetched(forecast.fetchedAt)}</>
        )}
        {forecast.holes.length > 0 && (
          <span className="muted"> · {forecast.holes.length} timer mangler i kilden</span>
        )}
      </p>

      <Verdict pick={verdict} />

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

      {spot.warning && <div className="warnbox">⚠ {spot.warning}</div>}
      {spot.adjustableNormal && (
        <NormalSetting
          key={spot.id}
          spot={spot}
          onChange={() => setNormalVersion((v) => v + 1)}
        />
      )}

      <Barograph
        days={days}
        selected={selected?.time ?? null}
        onSelect={(b) => setSelectedTime(b.time)}
      />

      {selected && <BlockDetail block={selected} spot={spot} />}
    </div>
  );
}
