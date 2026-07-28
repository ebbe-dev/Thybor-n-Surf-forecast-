// Udklappelig forklaring. Fylder én linje sammenfoldet, forklarer i
// almindeligt dansk foldet ud. Native <details> — ingen state at vedligeholde.

import type { ReactNode } from "react";
import { BANDS } from "../lib/colors";
import { fmt } from "../lib/format";

export function Info({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="info">
      <summary>{q}</summary>
      <div className="info-body">{children}</div>
    </details>
  );
}

// Farveskalaen med ord — samme farve betyder det samme i hele appen.
export function Legend() {
  const bands = [...BANDS].reverse(); // laveste først
  return (
    <ul className="legend">
      {bands.map((b, i) => {
        const next = bands[i + 1];
        const range = next ? `${fmt(b.min)}–${fmt(next.min)}` : `${fmt(b.min)}+`;
        return (
          <li key={b.min}>
            <span className="dot" style={{ background: b.hex }} />
            <span className="legend-range">{range}</span> {b.label}
          </li>
        );
      })}
    </ul>
  );
}
