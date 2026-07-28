// Vandret barograf: 7 dage × 6 blokke (05–20). Søjlehøjde = score,
// farve fra skalaen, vindpil over hver søjle. Eneste sted i appen
// med vandret scroll.

import type { Day, Block } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { BLOCK_HOURS, fmtDayLabel } from "../lib/time";
import { nowLocalIso } from "../lib/blocks";
import { WindArrow } from "./WindArrow";

interface Props {
  days: Day[];
  selected: string | null; // blokkens time-ISO
  onSelect: (b: Block) => void;
}

export function Barograph({ days, selected, onSelect }: Props) {
  const now = nowLocalIso();
  return (
    <div className="baro" role="listbox" aria-label="7-døgns barograf">
      {days.map((day) => (
        <div className="baro-day" key={day.date}>
          <div className="baro-daylabel">{fmtDayLabel(day.date + "T12:00")}</div>
          <div className="baro-blocks">
            {day.blocks.map((b, i) =>
              b === null ? (
                <div className="baro-block baro-hole" key={i} title="hul i data">
                  <span className="baro-hour">{String(BLOCK_HOURS[i]).padStart(2, "0")}</span>
                </div>
              ) : (
                <button
                  key={b.time}
                  className={
                    "baro-block" +
                    (selected === b.time ? " selected" : "") +
                    (b.time < now ? " past" : "")
                  }
                  onClick={() => onSelect(b)}
                  role="option"
                  aria-selected={selected === b.time}
                >
                  <span className="baro-arrow">
                    <WindArrow deg={b.row.wdir} spd={b.row.wspd} />
                  </span>
                  <span className="baro-barwrap">
                    <span
                      className="baro-bar"
                      style={{
                        height: `${Math.max(3, (b.score / 10) * 100)}%`,
                        background: scoreColor(b.score)
                      }}
                    />
                  </span>
                  <span className="baro-hour">{String(BLOCK_HOURS[i]).padStart(2, "0")}</span>
                </button>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
