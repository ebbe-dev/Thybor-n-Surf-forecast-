// Rangeringen: alle spots efter deres bedste dagslys-vindue i dag og i
// morgen, bedste øverst. Rækkefølgen ER rangeringen — ingen ekstra
// farvekoder; pillen viser scoren i appens faste farver. Tryk på en
// række vælger spottet (og dets bedste blok) i ugeoversigten nedenunder.
// Selve rangeringen bor i lib/blocks.ts (rankSpots) og deles med dommen.
// Et dobbelttryk på en række åbner kortet på spottet til det tidspunkt.

import { useRef } from "react";
import type { VerdictPick } from "../lib/blocks";
import { isDoubleTap } from "../lib/double-tap";
import { fmtClock, relativeDayLabel, todayIso } from "../lib/time";
import { ScorePill } from "./ScorePill";

interface Props {
  entries: VerdictPick[];
  selectedId: string;
  onSelect: (spotId: string, time: string) => void;
  onOpenMap: (spotId: string, time: string) => void;
}

export function QuickPick({ entries, selectedId, onSelect, onOpenMap }: Props) {
  const taps = useRef(new Map<string, number>());
  if (entries.length === 0) return null;
  const today = todayIso();
  return (
    <section className="card">
      <div className="card-h">
        <span>Hvor ellers · bedste vindue i dagslys</span>
        <span className="card-h-hint">2× tryk = kortet</span>
      </div>
      {entries.map(({ spot, block }, i) => (
        <button
          key={spot.id}
          className={"rank-row" + (spot.id === selectedId ? " sel" : "")}
          onClick={() => {
            if (isDoubleTap(taps.current, spot.id)) onOpenMap(spot.id, block.time);
            else onSelect(spot.id, block.time);
          }}
          aria-pressed={spot.id === selectedId}
        >
          <span className="rk">{i + 1}</span>
          <span className="nm">
            {spot.shortName}
            {spot.uncalibrated && <span className="uncal-inline"> ukal.</span>}
          </span>
          <span className="wh">
            {relativeDayLabel(block.time, today)} kl. {fmtClock(block.time)}
          </span>
          <ScorePill score={block.score} />
        </button>
      ))}
    </section>
  );
}
