// Dommen som helte-kort: dommens ord, spot, hvornår og hvilken side, de
// tal du kører efter, og scoren stort. Kanten har scorens farve — det
// eneste sted i appen, hvor en kant bærer bandfarve.

import type { CSSProperties } from "react";
import type { VerdictPick } from "../lib/blocks";
import { scoreColor, scoreLabel } from "../lib/colors";
import { fmtClock, relativeDayLabel } from "../lib/time";
import { fmt, compass } from "../lib/format";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Verdict({ pick, sun }: { pick: VerdictPick | null; sun: string | null }) {
  const eyebrow = (
    <div className="eyebrow">
      <span className="dot" />
      Næste 2 døgn
      {sun && (
        <>
          <span className="sep">·</span>
          {sun}
        </>
      )}
    </div>
  );

  if (!pick) {
    return (
      <section className="hero">
        {eyebrow}
        <h1 className="hero-label muted">Ingen kommende blokke i data</h1>
      </section>
    );
  }

  const { spot, block } = pick;
  const r = block.row;
  const color = scoreColor(block.score);
  return (
    <section className="hero" style={{ "--band": color } as CSSProperties}>
      {eyebrow}
      <div className="hero-row">
        <div className="hero-main">
          <h1 className="hero-label" style={{ color }}>
            {scoreLabel(block.score)}
          </h1>
          <div className="hero-spot">
            {spot.shortName}
            {spot.uncalibrated && <span className="uncal-inline"> · ukalibreret</span>}
          </div>
          <div className="hero-when">
            <strong>
              {cap(relativeDayLabel(block.time))} kl. {fmtClock(block.time)}
            </strong>
            {" · "}
            {spot.fixedSide ? "surfes på" : "læ på"} {block.side}siden
          </div>
          <div className="hero-sub">
            {fmt(r.hs)} m / {fmt(r.tp)} s · vind {compass(r.wdir)} {fmt(r.wspd, 0)} m/s
          </div>
        </div>
        <div className="hero-score">
          <div className="n" style={{ color }}>
            {fmt(block.score)}
          </div>
          <div className="d">af 10</div>
        </div>
      </div>
    </section>
  );
}
