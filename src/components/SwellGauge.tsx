// Skalaen under tallene: hvor perioden ligger mellem wind swell og ground
// swell. Stregen midt på er grænsen (8 s), prikken er timens periode, og
// den ende, der gælder, står lys. Så kan man se, om det er lige på kanten.

import { GAUGE_MAX_TP, GAUGE_MIN_TP, GROUND_SWELL_MIN_TP, gaugePosition, swellKind } from "../lib/swell";

export function SwellGauge({ tp }: { tp: number }) {
  const kind = swellKind(tp);
  const pos = gaugePosition(tp) * 100;
  const tick = ((GROUND_SWELL_MIN_TP - GAUGE_MIN_TP) / (GAUGE_MAX_TP - GAUGE_MIN_TP)) * 100;
  return (
    <div className="swell-gauge" aria-label={`periode ${tp.toFixed(1)} s på skalaen fra wind swell til ground swell`}>
      <div className="sg-track">
        <span className="sg-fill" style={{ width: `${pos}%` }} />
        <span className="sg-tick" style={{ left: `${tick}%` }} />
        <span className="sg-dot" style={{ left: `${pos}%` }} />
      </div>
      <div className="sg-labels">
        <span className={kind === "wind" ? "on" : ""}>Wind swell</span>
        <span className="sg-mid" style={{ left: `${tick}%` }}>
          {GROUND_SWELL_MIN_TP} s
        </span>
        <span className={kind === "ground" ? "on" : ""}>Ground swell</span>
      </div>
    </div>
  );
}
