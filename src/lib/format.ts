// Talformat (dansk komma) og kompasretninger.

export function fmt(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

const COMPASS = [
  "N", "NNØ", "NØ", "ØNØ", "Ø", "ØSØ", "SØ", "SSØ",
  "S", "SSV", "SV", "VSV", "V", "VNV", "NV", "NNV"
];

export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
