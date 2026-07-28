// Fordeling af timescores + dage over tærsklerne. Søjlehøjden er
// kvadratrods-skaleret (ellers drukner de sjældne, gode timer i alle
// nul-timerne) — de ærlige antal står på søjlerne.

import { scoreColor, MUTED } from "../lib/colors";
import { scoreLabel } from "../lib/colors";
import { fmt } from "../lib/format";

interface Props {
  bins: number[]; // timer pr. heltalsbin 0..9
  daysOver: { threshold: number; days: number }[];
  totalDays: number;
}

export function ScoreDist({ bins, daysOver, totalDays }: Props) {
  const max = Math.sqrt(Math.max(...bins, 1));
  return (
    <div>
      <svg viewBox="0 0 340 110" className="scoredist" aria-label="scorefordeling">
        {bins.map((n, i) => {
          const h = n === 0 ? 0 : Math.max(3, (Math.sqrt(n) / max) * 78);
          const x = 8 + i * 33;
          return (
            <g key={i}>
              <rect x={x} y={92 - h} width={26} height={h} fill={scoreColor(i + 0.5)} />
              {n > 0 && (
                <text x={x + 13} y={88 - h} fontSize="8" fill={MUTED} textAnchor="middle">
                  {n}
                </text>
              )}
              <text x={x + 13} y={103} fontSize="9" fill={MUTED} textAnchor="middle">
                {i}
              </text>
            </g>
          );
        })}
      </svg>
      <table className="threshold-table">
        <tbody>
          {daysOver.map(({ threshold, days }) => (
            <tr key={threshold}>
              <td>
                <span className="dot" style={{ background: scoreColor(threshold) }} />
                maks ≥ {fmt(threshold)} <span className="muted">({scoreLabel(threshold)})</span>
              </td>
              <td>
                <strong>{days}</strong> <span className="muted">af {totalDays} dage</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
