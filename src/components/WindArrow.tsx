// Meteorologisk pil: peger den vej vinden blæser HEN (wdir + 180).

import { MUTED, FG } from "../lib/colors";

export function WindArrow({ deg, spd, size = 16 }: { deg: number; spd: number; size?: number }) {
  const strong = spd >= 8;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      style={{ transform: `rotate(${deg + 180}deg)` }}
      aria-label={`vind ${Math.round(deg)}°`}
    >
      <line
        x1="8" y1="14" x2="8" y2="3.5"
        stroke={strong ? FG : MUTED}
        strokeWidth={strong ? 2.4 : 1.6}
      />
      <path
        d="M8 1 L4.6 6.4 L8 4.8 L11.4 6.4 Z"
        fill={strong ? FG : MUTED}
      />
    </svg>
  );
}
