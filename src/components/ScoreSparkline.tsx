// Scoren time for time fra nu til enden af horisonten, som en lille graf i
// spot-kortet. Bunden er 0 og toppen 10 på alle kort, så de kan sammen-
// lignes, når man swiper. Fladen under kurven bærer skalaens farver efter
// højden (samme farve = samme betydning som overalt), nætterne er mørke,
// dagsskel har etiket, og det vindue kortet handler om, er en prik i
// bandfarven. Ingen akser — det er et blik, ikke en tabel; tallene står i
// søjlerne længere nede.

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Block } from "../lib/blocks";
import type { Spot } from "../config/spots";
import { BANDS, BG, FG, MUTED, scoreColor } from "../lib/colors";
import { dayName, hourOf } from "../lib/time";
import { sunTimes } from "../lib/sun";

interface Props {
  blocks: Map<string, Block>; // spottets timescorer (lib/blocks.ts, hourlyBlocks)
  from: string; // ISO-time for nu (hel time) — grafens venstre kant
  dates: string[]; // horisontens dage, første er i dag
  pick: Block; // det vindue kortet handler om
  spot: Spot; // til solopgang/-nedgang
}

const H = 44; // grafens højde
const LABELS = 16; // plads til dagsetiketter under
const pad2 = (n: number) => String(n).padStart(2, "0");

// Bredden måles, så intet strækkes: tekst og prikker skal være skarpe.
function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [w, setW] = useState(320);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(120, Math.round(el.clientWidth)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

export function ScoreSparkline({ blocks, from, dates, pick, spot }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const W = useWidth(wrap);

  // Tid regnes i timer siden nu. Sidste time er kl. 23 på horisontens sidste dag.
  const startHour = hourOf(from);
  const span = dates.length * 24 - 1 - startHour; // timer fra nu til sidste time
  if (span <= 0) return null;
  const x = (hoursFromNow: number) => (hoursFromNow / span) * W;
  const y = (score: number) => H - (score / 10) * H;

  // Punkter pr. time; huller i kilden bliver huller i kurven.
  type Pt = { x: number; y: number };
  const runs: Pt[][] = [];
  let run: Pt[] = [];
  let pickPt: Pt | null = null;
  for (let h = 0; h <= span; h++) {
    const abs = startHour + h;
    const date = dates[Math.floor(abs / 24)];
    const time = `${date}T${pad2(abs % 24)}:00`;
    const b = blocks.get(time);
    if (!b) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    const pt = { x: x(h), y: y(b.score) };
    run.push(pt);
    if (time === pick.time) pickPt = pt;
  }
  if (run.length) runs.push(run);

  const linePath = runs
    .map((r) => r.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "))
    .join(" ");
  const areaPath = runs
    .map((r) => {
      const first = r[0];
      const last = r[r.length - 1];
      return (
        `M${first.x.toFixed(1)},${H} ` +
        r.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
        ` L${last.x.toFixed(1)},${H} Z`
      );
    })
    .join(" ");

  // Nætter: fra dagens start til solopgang og fra solnedgang til midnat.
  const nights: { x1: number; x2: number }[] = [];
  const dayCols: { x1: number; x2: number; label: string }[] = [];
  dates.forEach((date, i) => {
    const dayStart = i * 24 - startHour; // timer siden nu
    const dayEnd = dayStart + 24;
    const st = sunTimes(date, spot.lat, spot.lon);
    const dark: [number, number][] =
      st === "altid" ? [] : st === "aldrig" ? [[dayStart, dayEnd]] : [[dayStart, dayStart + st.sunrise], [dayStart + st.sunset, dayEnd]];
    for (const [a, b] of dark) {
      const x1 = Math.max(0, a);
      const x2 = Math.min(span, b);
      if (x2 > x1) nights.push({ x1: x(x1), x2: x(x2) });
    }
    const x1 = x(Math.max(0, dayStart));
    const x2 = x(Math.min(span, dayEnd));
    const width = x2 - x1;
    // Etiket: "i dag", "i morgen" hvis der er plads, ellers ugedagen kort.
    const label =
      i === 0 ? "i dag" : i === 1 && width >= 64 ? "i morgen" : dayName(date + "T12:00", true);
    dayCols.push({ x1, x2, label });
  });
  // Etiketterne står ved deres dagsskel, men skubbes til højre, hvis den
  // forrige ikke er færdig (sent på dagen er "i dag" smallere end sit ord);
  // en etiket der ikke kan være inden for kanten, udelades.
  const labels: { x: number; text: string }[] = [];
  let nextFree = 0;
  for (const d of dayCols) {
    const text = d.label.toUpperCase();
    const width = text.length * 7; // 10 px fed versal ≈ 7 px pr. tegn
    const lx = Math.max(d.x1 + 3, nextFree);
    if (lx + width > W) continue;
    labels.push({ x: lx, text });
    nextFree = lx + width + 8;
  }

  // Fladen under kurven i skalaens farver: hårde overgange ved båndgrænserne.
  // BANDS er sorteret højeste først, så stoppene kommer oppefra og ned —
  // SVG kræver stigende offsets, ellers klippes de følgende stop væk.
  const gradientStops = BANDS.flatMap((b, i) => {
    const top = i === 0 ? 0 : y(BANDS[i - 1].min) / H;
    const bottom = y(b.min) / H;
    return [
      { offset: top, color: b.hex },
      { offset: bottom, color: b.hex }
    ];
  });
  const gradId = `spark-${spot.id}`;
  const pickColor = scoreColor(pick.score);

  return (
    <div className="spark" ref={wrap} aria-label="score time for time">
      <svg width={W} height={H + LABELS} viewBox={`0 0 ${W} ${H + LABELS}`}>
        <defs>
          <linearGradient id={gradId} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2={H}>
            {gradientStops.map((s, i) => (
              <stop key={i} offset={s.offset} stopColor={s.color} />
            ))}
          </linearGradient>
        </defs>
        {/* bundlinje */}
        <line x1="0" y1={H} x2={W} y2={H} stroke={MUTED} strokeOpacity="0.35" />
        <path d={areaPath} fill={`url(#${gradId})`} fillOpacity="0.5" />
        <path d={linePath} fill="none" stroke={FG} strokeOpacity="0.85" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {nights.map((n, i) => (
          <rect key={i} x={n.x1} y="0" width={n.x2 - n.x1} height={H} fill={BG} fillOpacity="0.5" />
        ))}
        {dayCols.map((d, i) =>
          i > 0 ? (
            <line key={d.label + i} x1={d.x1} y1="0" x2={d.x1} y2={H + 4} stroke={MUTED} strokeOpacity="0.5" />
          ) : null
        )}
        {labels.map((l) => (
          <text key={l.text + l.x} x={l.x} y={H + LABELS - 4} fill={MUTED} fontSize="10" fontWeight="700" letterSpacing="0.8">
            {l.text}
          </text>
        ))}
        {pickPt && (
          <circle cx={pickPt.x} cy={pickPt.y} r="5" fill={pickColor} stroke={BG} strokeWidth="2" />
        )}
      </svg>
    </div>
  );
}
