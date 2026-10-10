// Panelet øverst på kortet, mens et spot tjekkes: retningen med ±1°,
// hvad man skal gøre, og Bekræft/Annullér. Selve flytningen sker på
// kortet — prikken og pilespidsen kan trækkes (MapScreen).

import type { Spot, SpotGeometry } from "../config/spots";
import { compass, fmt } from "../lib/format";

interface Props {
  spot: Spot;
  geo: SpotGeometry; // det ugemte sted og retning under tjekket
  movedM: number; // hvor langt prikken er trukket fra det gemte sted
  onTurn: (deltaDeg: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function CalibratePanel({ spot, geo, movedM, onTurn, onConfirm, onCancel }: Props) {
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
      <p className="cal-hint">
        Træk <strong>prikken</strong> hen til stedet. Træk <strong>pilespidsen</strong>, til pilen
        peger ud mod havet og den stiplede streg ligger langs kysten
        {spot.groynes ? " — de lyse streger skal ligge oven i høfderne" : ""}.
        {movedM >= 5 && <> Prikken er flyttet {fmt(movedM, 0)} m.</>}
      </p>
      <div className="cal-actions">
        <button className="btn" onClick={onConfirm}>
          Bekræft sted og retning
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Annullér
        </button>
      </div>
    </section>
  );
}
