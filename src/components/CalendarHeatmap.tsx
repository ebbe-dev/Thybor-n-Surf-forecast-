// Kalender-heatmap: én celle pr. dag, farvet efter dagens højeste score.
// GitHub-stil: kolonner = uger, rækker = ugedage (mandag øverst).
// Dage uden data er tomme celler med kant — huller, ikke nuller.

import { useMemo } from "react";
import type { DayStat } from "../lib/history";
import { scoreColor, MUTED } from "../lib/colors";

interface Props {
  days: Map<string, DayStat>;
  start: string; // YYYY-MM-DD
  end: string;
  selected: string | null;
  onSelect: (date: string) => void;
}

const CELL = 7;
const GAP = 1.6;
const MONTHS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function* dateRange(start: string, end: string): Generator<string> {
  const d = new Date(start + "T12:00");
  const stop = new Date(end + "T12:00");
  while (d <= stop) {
    yield d.toISOString().slice(0, 10);
    d.setDate(d.getDate() + 1);
  }
}

export function CalendarHeatmap({ days, start, end, selected, onSelect }: Props) {
  const cells = useMemo(() => {
    const list: { date: string; col: number; row: number; monthStart: boolean }[] = [];
    let col = 0;
    let prev = -1;
    for (const date of dateRange(start, end)) {
      const dow = (new Date(date + "T12:00").getDay() + 6) % 7; // man=0
      if (dow <= prev && prev !== -1) col++;
      prev = dow;
      list.push({ date, col, row: dow, monthStart: date.slice(8, 10) === "01" });
    }
    return list;
  }, [start, end]);

  const weeks = cells.length > 0 ? cells[cells.length - 1].col + 1 : 0;
  const w = weeks * (CELL + GAP) + 24;
  const h = 7 * (CELL + GAP) + 14;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="heatmap" aria-label="kalender-heatmap">
      {["man", "ons", "fre"].map((label, i) => (
        <text key={label} x={0} y={12 + (i * 2 + 0.8) * (CELL + GAP) + CELL} fontSize={5.5} fill={MUTED}>
          {label}
        </text>
      ))}
      {cells.map((c) => {
        const day = days.get(c.date);
        const x = 24 + c.col * (CELL + GAP);
        const y = 12 + c.row * (CELL + GAP);
        return (
          <g key={c.date}>
            {c.monthStart && c.row === 0 && null}
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill={day ? scoreColor(day.max) : "none"}
              stroke={c.date === selected ? "#E7E2D3" : day ? "none" : "#22332F"}
              strokeWidth={c.date === selected ? 1.2 : 0.5}
              onClick={() => day && onSelect(c.date)}
              style={{ cursor: day ? "pointer" : "default" }}
            />
          </g>
        );
      })}
      {cells
        .filter((c) => c.monthStart)
        .map((c) => (
          <text key={"m" + c.date} x={24 + c.col * (CELL + GAP)} y={8} fontSize={6} fill={MUTED}>
            {MONTHS[Number(c.date.slice(5, 7)) - 1]}
          </text>
        ))}
    </svg>
  );
}
