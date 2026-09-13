// Kalender-heatmap: én celle pr. dag, farvet efter dagens højeste score.
// Rækker = måneder, kolonner = dag i måneden — så felterne er store nok
// at ramme på en telefon, og sæsonmønsteret læses lodret.
// Dage uden data er tomme celler med kant — huller, ikke nuller.

import { useMemo } from "react";
import type { DayStat } from "../lib/history";
import { scoreColor, FG, MUTED } from "../lib/colors";
import { monthShort } from "../lib/time";

interface Props {
  days: Map<string, DayStat>;
  start: string; // YYYY-MM-DD
  end: string;
  selected: string | null;
  onSelect: (date: string) => void;
}

const CW = 10.5;
const CH = 13;
const GAP = 1.5;
const LEFT = 36;
const TOP = 12;

function* dateRange(start: string, end: string): Generator<string> {
  const d = new Date(start + "T12:00");
  const stop = new Date(end + "T12:00");
  while (d <= stop) {
    yield d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
}

export function CalendarHeatmap({ days, start, end, selected, onSelect }: Props) {
  const { cells, months } = useMemo(() => {
    const months: string[] = []; // "YYYY-MM" i rækkefølge
    const cells: { date: string; row: number; col: number }[] = [];
    for (const date of dateRange(start, end)) {
      const key = date.slice(0, 7);
      if (months[months.length - 1] !== key) months.push(key);
      cells.push({ date, row: months.length - 1, col: Number(date.slice(8, 10)) - 1 });
    }
    return { cells, months };
  }, [start, end]);

  const w = LEFT + 31 * (CW + GAP);
  const h = TOP + months.length * (CH + GAP) + 2;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="heatmap" aria-label="kalender-heatmap">
      {[1, 10, 20, 31].map((d) => (
        <text
          key={d}
          x={LEFT + (d - 1) * (CW + GAP) + CW / 2}
          y={TOP - 4}
          fontSize={6.5}
          fill={MUTED}
          textAnchor="middle"
        >
          {d}
        </text>
      ))}
      {months.map((key, row) => {
        const m = Number(key.slice(5, 7)) - 1;
        const label = row === 0 || m === 0 ? `${monthShort(m)} ${key.slice(2, 4)}` : monthShort(m);
        return (
          <text
            key={key}
            x={0}
            y={TOP + row * (CH + GAP) + CH * 0.78}
            fontSize={7}
            fontWeight={700}
            fill={MUTED}
          >
            {label}
          </text>
        );
      })}
      {cells.map((c) => {
        const day = days.get(c.date);
        const x = LEFT + c.col * (CW + GAP);
        const y = TOP + c.row * (CH + GAP);
        const sel = c.date === selected;
        return (
          <rect
            key={c.date}
            x={x}
            y={y}
            width={CW}
            height={CH}
            rx={2}
            fill={day ? scoreColor(day.max) : "none"}
            stroke={sel ? FG : day ? "none" : "#22332F"}
            strokeWidth={sel ? 1.4 : 0.5}
            data-has={day ? "1" : undefined}
            onClick={() => day && onSelect(c.date)}
            style={{ cursor: day ? "pointer" : "default" }}
          />
        );
      })}
    </svg>
  );
}
