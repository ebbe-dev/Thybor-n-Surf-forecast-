// Planview af en høfde set ovenfra, nord opad. Land og høfde ligger efter
// spottets kystnormal, vindpilen roterer med vinden, og læsiden skraveres.

import { MUTED, FG } from "../lib/colors";
import { compass, fmt } from "../lib/format";

interface Props {
  normal: number; // kystnormal, grader
  wdir: number;
  wspd: number;
  side: "nord" | "syd";
}

const rad = (d: number) => (d * Math.PI) / 180;
// Kompasgrader → SVG-enhedsvektor (nord op, øst højre).
const vec = (d: number) => ({ x: Math.sin(rad(d)), y: -Math.cos(rad(d)) });
const add = (a: { x: number; y: number }, ...vs: { x: number; y: number }[]) =>
  vs.reduce((p, v) => ({ x: p.x + v.x, y: p.y + v.y }), a);
const mul = (v: { x: number; y: number }, k: number) => ({ x: v.x * k, y: v.y * k });
const pt = (p: { x: number; y: number }) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

export function GroynePlan({ normal, wdir, side, wspd }: Props) {
  const C = { x: 175, y: 115 };
  const s = vec(normal); // udad mod havet
  const t = vec(normal + 90); // langs kysten
  // Hvilken af ±t peger nordligst (mindst SVG-y)?
  const tN = t.y <= 0 ? t : mul(t, -1);
  const lee = side === "nord" ? tN : mul(tN, -1);

  const land = [
    add(C, mul(t, 160)),
    add(C, mul(t, -160)),
    add(C, mul(t, -160), mul(s, -160)),
    add(C, mul(t, 160), mul(s, -160))
  ];
  const groyneEnd = add(C, mul(s, 92));
  const leePoly = [C, groyneEnd, add(groyneEnd, mul(lee, 42)), add(C, mul(lee, 42))];
  const leeLabel = add(C, mul(s, 46), mul(lee, 24));

  // Vindpil: starter opvind, peger nedvind, ude over vandet.
  const down = vec(wdir + 180);
  const wTail = add(C, mul(s, 66), mul(vec(wdir), 52));
  const wHead = add(wTail, mul(down, 46));
  const headL = add(wHead, mul(vec(wdir + 150), 12));
  const headR = add(wHead, mul(vec(wdir + 210), 12));

  return (
    <svg viewBox="0 0 350 230" className="groyne-plan" aria-label="høfde-planview">
      {/* hav */}
      <rect x="0" y="0" width="350" height="230" fill="#0E2320" />
      {/* land */}
      <polygon points={land.map(pt).join(" ")} fill="#1A2C25" stroke={MUTED} strokeWidth="1" />
      {/* læside */}
      <polygon points={leePoly.map(pt).join(" ")} fill={MUTED} opacity="0.28" />
      <text x={leeLabel.x} y={leeLabel.y} fill={FG} fontSize="13" textAnchor="middle" fontWeight="700">
        læ ({side})
      </text>
      {/* høfde */}
      <line x1={C.x} y1={C.y} x2={groyneEnd.x} y2={groyneEnd.y} stroke={FG} strokeWidth="7" strokeLinecap="round" />
      {/* vindpil */}
      <line x1={wTail.x} y1={wTail.y} x2={wHead.x} y2={wHead.y} stroke={FG} strokeWidth="3" />
      <polygon points={`${pt(wHead)} ${pt(headL)} ${pt(headR)}`} fill={FG} />
      <text x={wTail.x} y={wTail.y - 8} fill={FG} fontSize="12" textAnchor="middle" fontWeight="700">
        {compass(wdir)} {fmt(wspd, 0)} m/s
      </text>
      {/* nordmarkør */}
      <text x="14" y="22" fill={MUTED} fontSize="13" fontWeight="700">N ↑</text>
    </svg>
  );
}
