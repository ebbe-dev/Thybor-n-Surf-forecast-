// Mærket GROUND SWELL / WIND SWELL ved bølgetallene — samme ord overalt:
// på spot-kortet, under tallene, i historikken, i loggen og på kortets
// skilte. Ground swell lyser (fyldt), wind swell står i kontur.

import { swellKind, swellLabel } from "../lib/swell";

// Står ved siden af WIND SWELL, når der ligger en lang dønning under
// vindsøen (lib/swell.ts, groundSwellUnder).
export function UnderChip({ big = false }: { big?: boolean }) {
  return <span className={"swell-chip under" + (big ? " big" : "")}>ground swell under</span>;
}

export function SwellChip({ tp, big = false }: { tp: number; big?: boolean }) {
  const kind = swellKind(tp);
  return (
    <span className={"swell-chip " + kind + (big ? " big" : "")} data-kind={kind}>
      {swellLabel(kind)}
    </span>
  );
}
