// Mærket GROUND SWELL / WIND SWELL ved bølgetallene — samme ord overalt:
// på spot-kortet, under tallene, i historikken, i loggen og på kortets
// skilte. Ground swell lyser (fyldt), wind swell står i kontur.

import { swellKind, swellLabel } from "../lib/swell";

export function SwellChip({ tp, big = false }: { tp: number; big?: boolean }) {
  const kind = swellKind(tp);
  return (
    <span className={"swell-chip " + kind + (big ? " big" : "")} data-kind={kind}>
      {swellLabel(kind)}
    </span>
  );
}
