// Spot-valg som én vandret række chips — samme komponent på NU, HISTORIK
// og LOG. Den valgte chip rulles ind i billedet, hvis den står udenfor.

import { useEffect, useRef } from "react";
import { SPOTS } from "../config/spots";

export function SpotChips({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = ref.current;
    const el = wrap?.querySelector<HTMLElement>(".chip.on");
    if (!wrap || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < wrap.scrollLeft || right > wrap.scrollLeft + wrap.clientWidth) {
      wrap.scrollTo({ left: Math.max(0, left - 12), behavior: "smooth" });
    }
  }, [value]);

  return (
    <div className="chips" ref={ref} role="tablist" aria-label="spot">
      {SPOTS.map((s) => (
        <button
          key={s.id}
          role="tab"
          aria-selected={s.id === value}
          className={"chip" + (s.id === value ? " on" : "")}
          onClick={() => onChange(s.id)}
        >
          {s.shortName}
          {s.uncalibrated && <span className="chip-uncal">UKAL.</span>}
        </button>
      ))}
    </div>
  );
}
