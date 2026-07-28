// Vindrose: hvilke vindretninger der faktisk gav score over tærsklen.
// Kronbladslængde ∝ antal timer i sektoren.

import { FG, MUTED } from "../lib/colors";

const rad = (d: number) => ((d - 90) * Math.PI) / 180;

export function WindRose({ counts }: { counts: number[] }) {
  const R = 70;
  const cx = 90;
  const cy = 84;
  const max = Math.max(...counts, 1);

  return (
    <svg viewBox="0 0 180 172" className="windrose" aria-label="vindrose">
      {[0.5, 1].map((f) => (
        <circle key={f} cx={cx} cy={cy} r={R * f} fill="none" stroke="#22332F" strokeWidth="1" />
      ))}
      {counts.map((n, i) => {
        if (n === 0) return null;
        const r = (n / max) * R;
        const a0 = rad(i * 22.5 - 10);
        const a1 = rad(i * 22.5 + 10);
        const p = `M ${cx} ${cy} L ${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${
          cx + r * Math.cos(a1)
        } ${cy + r * Math.sin(a1)} Z`;
        return <path key={i} d={p} fill={FG} opacity={0.35 + 0.65 * (n / max)} />;
      })}
      {(
        [
          ["N", 0],
          ["Ø", 90],
          ["S", 180],
          ["V", 270]
        ] as const
      ).map(([label, deg]) => (
        <text
          key={label}
          x={cx + (R + 10) * Math.cos(rad(deg))}
          y={cy + (R + 10) * Math.sin(rad(deg)) + 3}
          fontSize="9"
          fontWeight="700"
          fill={MUTED}
          textAnchor="middle"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}
