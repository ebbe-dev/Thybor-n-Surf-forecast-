// Dommen: bedste kommende blok — dag, klokkeslæt, mole, side.

import type { VerdictPick } from "../lib/blocks";
import { scoreColor, scoreLabel } from "../lib/colors";
import { dayName, fmtClock, isToday } from "../lib/time";
import { fmt } from "../lib/format";

export function Verdict({ pick }: { pick: VerdictPick | null }) {
  if (!pick) {
    return (
      <section className="verdict">
        <h1 className="verdict-label muted">Ingen kommende blokke i data</h1>
      </section>
    );
  }
  const { spot, block } = pick;
  const color = scoreColor(block.score);
  const when = isToday(block.time) ? "i dag" : dayName(block.time);
  return (
    <section className="verdict" style={{ borderColor: color }}>
      <h1 className="verdict-label" style={{ color }}>
        {scoreLabel(block.score)}
      </h1>
      <p className="verdict-line">
        <strong>
          {when} kl. {fmtClock(block.time)}
        </strong>{" "}
        · {spot.shortName} · læ på <strong>{block.side}siden</strong>
        {spot.uncalibrated && <span className="uncal-inline"> · UKALIBRERET</span>}
      </p>
      <p className="verdict-score">
        <span style={{ color }}>{fmt(block.score)}</span>
        <span className="muted"> / 10</span>
      </p>
    </section>
  );
}
