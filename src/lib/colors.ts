// Farveskalaen. Samme farve betyder det samme i alle visninger —
// barograf, kort, kalender. Importér herfra, hardcod aldrig en scorefarve.

export const BG = "#0B1917";
export const FG = "#E7E2D3";
export const MUTED = "#6F847F";

interface Band {
  min: number;
  hex: string;
  label: string;
}

// Sorteret højeste først; scoreColor tager første bånd hvor score >= min.
export const BANDS: Band[] = [
  { min: 8, hex: "#FF7A45", label: "Aflys hvad du har" },
  { min: 6, hex: "#E2542A", label: "Tag afsted" },
  { min: 3.5, hex: "#C2AC83", label: "Værd at køre" },
  { min: 1.5, hex: "#1F4741", label: "Kun hvis du keder dig" },
  { min: 0, hex: "#2C5C55", label: "Bliv hjemme" }
];

export function scoreColor(score: number): string {
  for (const b of BANDS) if (score >= b.min) return b.hex;
  return BANDS[BANDS.length - 1].hex;
}

export function scoreLabel(score: number): string {
  for (const b of BANDS) if (score >= b.min) return b.label;
  return BANDS[BANDS.length - 1].label;
}
