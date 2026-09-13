// Score i en pille: bandfarven som baggrund, teksten mørk eller lys efter
// kontrast — så tallet altid kan læses, også i de mørke bånd.

import { scoreColor, scoreTextColor } from "../lib/colors";
import { fmt } from "../lib/format";

export function ScorePill({ score, large = false }: { score: number; large?: boolean }) {
  return (
    <span
      className={"pill" + (large ? " pill-lg" : "")}
      style={{ background: scoreColor(score), color: scoreTextColor(score) }}
    >
      {fmt(score)}
    </span>
  );
}
