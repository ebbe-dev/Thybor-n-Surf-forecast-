// Panelet øverst på kortet, mens et spot tjekkes: retningen med ±1°,
// hvad man skal gøre, og Bekræft/Annullér. Selve flytningen sker på
// kortet — prikken og pilespidsen kan trækkes (MapScreen).

import type { Spot, SpotGeometry } from "../config/spots";
import { compass, fmt } from "../lib/format";

interface Props {
  spot: Spot;
  geo: SpotGeometry; // det ugemte sted og retning under tjekket
  movedM: number; // hvor langt prikken er trukket fra det gemte sted
  isAppValue: boolean; // står panelet på appens egne værdier?
  onTurn: (deltaDeg: number) => void;
  onReset: () => void; // tilbage til appens værdier (gemmes først ved Bekræft)
  onConfirm: () => void;
  onCancel: () => void;
}

export function CalibratePanel({
  spot,
  geo,
  movedM,
  isAppValue,
  onTurn,
  onReset,
  onConfirm,
  onCancel
}: Props) {
  return (
    <section className="cal-panel" aria-label="tjek sted og retning">
      <div className="cal-eyebrow">Tjek på kortet · {spot.shortName}</div>
      <div className="cal-row">
        <span className="cal-dir">
          Vender mod{" "}
          <strong>
            {compass(geo.normal)} {geo.normal}°
          </strong>
        </span>
        <span className="cal-steps">
          <button className="step-btn" onClick={() => onTurn(-1)} aria-label="drej én grad mod uret">
            −
          </button>
          <button className="step-btn" onClick={() => onTurn(1)} aria-label="drej én grad med uret">
            +
          </button>
        </span>
      </div>
      {/* Panelet holder samme højde, mens der trækkes — ellers hopper kortet
          under fingeren. Derfor en fast statuslinje og en knap, der altid
          er der. */}
      <div className="cal-status muted" aria-live="polite">
        {movedM >= 5 ? `Prikken er flyttet ${fmt(movedM, 0)} m` : "\u00a0"}
      </div>
      <p className="cal-hint">
        {spot.groynes ? (
          <>
            Træk <strong>prikken</strong> ud på høfdens spids, den yderste ende.
          </>
        ) : (
          <>
            Træk <strong>prikken</strong> hen, hvor du går i.
          </>
        )}{" "}
        Træk <strong>pilespidsen</strong>, til pilen peger ud mod havet og den stiplede streg
        ligger langs kysten{spot.groynes ? " — de lyse streger skal ligge oven i høfderne" : ""}.
      </p>
      <div className="cal-actions">
        <button className="btn" onClick={onConfirm}>
          Bekræft sted og retning
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Annullér
        </button>
      </div>
      <button className="linkbtn cal-reset" onClick={onReset} disabled={isAppValue}>
        {isAppValue
          ? `Står på appens værdi (${compass(spot.shoreNormal)} ${spot.shoreNormal}°)`
          : `Sæt tilbage til appens værdi (${compass(spot.shoreNormal)} ${spot.shoreNormal}°)`}
      </button>
    </section>
  );
}
