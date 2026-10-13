// Talformat (dansk komma) og kompasretninger.

export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

// Vandstand i forhold til middel: altid med fortegn, "+0,3 m" / "−0,2 m".
export function fmtLevel(m: number): string {
  const v = Math.round(m * 10) / 10;
  return (v < 0 ? "−" : "+") + fmt(Math.abs(v)) + " m";
}

const COMPASS = [
  "N", "NNØ", "NØ", "ØNØ", "Ø", "ØSØ", "SØ", "SSØ",
  "S", "SSV", "SV", "VSV", "V", "VNV", "NV", "NNV"
];

export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
