// Planview af en høfde set ovenfra, nord opad: land og høfde ligger efter
// spottets retning, vinden kommer ind som en pil, bølgerne som stiplede
// pile, og høfdens LÆ — vindskyggen bag den — er fyldt ud og mærket.
// Siderne hedder N og S, så "læ på nordsiden" kan ses, ikke kun læses.
// Samme geometri som skyggen på kortet (lib/geo.ts, leeShadowLatLngs).

import { FG, MUTED } from "../lib/colors";
import { isOffshoreWind } from "../model/model";
import { fmt } from "../lib/format";

interface Props {
  normal: number; // spottets retning (ud mod havet), grader
  wdir: number; // vinden kommer FRA
  wspd: number;
  swdir: number; // bølgerne kommer FRA
  side: "nord" | "syd"; // læsiden (model.ts, leeSide) — eller spottets faste side
}

type V = { x: number; y: number };
const rad = (d: number) => (d * Math.PI) / 180;
// Kompasgrader → SVG-enhedsvektor (nord op, øst højre).
const vec = (d: number): V => ({ x: Math.sin(rad(d)), y: -Math.cos(rad(d)) });
const add = (a: V, ...vs: V[]): V => vs.reduce((p, v) => ({ x: p.x + v.x, y: p.y + v.y }), a);
const mul = (v: V, k: number): V => ({ x: v.x * k, y: v.y * k });
const dot = (a: V, b: V) => a.x * b.x + a.y * b.y;
const pt = (p: V) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`;

const W = 350;
const H = 230;
const GROYNE = 96; // høfdens længde på tegningen
const SHADOW = 0.8 * GROYNE; // vindskyggens længde med vinden (som på kortet)

export function GroynePlan({ normal, wdir, wspd, swdir, side }: Props) {
  const C: V = { x: 175, y: 118 }; // høfdens rod ved kystlinjen
  const s = vec(normal); // ud mod havet
  const t = vec(normal + 90); // langs kysten
  const tN = t.y <= 0 ? t : mul(t, -1); // den af siderne, der vender mest nord
  const tip = add(C, mul(s, GROYNE));

  // land: alt bag kystlinjen
  const land = [
    add(C, mul(t, 260)),
    add(C, mul(t, -260)),
    add(C, mul(t, -260), mul(s, -220)),
    add(C, mul(t, 260), mul(s, -220))
  ];

  // vindskyggen: fra kysten ud til spidsen, og derfra med vinden — aldrig
  // ind over land
  const dw = vec(wdir + 180); // vinden blæser hen
  const clampSea = (p: V): V => {
    const sea = dot(add(p, mul(C, -1)), s);
    return sea < 0 ? add(p, mul(s, -sea)) : p;
  };
  const shadow = [C, tip, add(tip, mul(dw, SHADOW)), clampSea(add(C, mul(dw, SHADOW)))];
  const lateral = dot(dw, tN); // + = skyggen ligger mod nord
  const shadowWidth = Math.abs(lateral) * SHADOW;
  const leeLabel = add(C, mul(s, GROYNE * 0.5), mul(tN, Math.sign(lateral || 1) * Math.min(shadowWidth, 60) * 0.55));
  // Blæser vinden langs høfden, giver den ingen læ: fra havet er der ingen
  // læ at hente, fra land er hele kysten i læ. Sig det, i stedet for at
  // lade et tyndt felt stå uden ord.
  const thin = shadowWidth < 14;
  const offshore = isOffshoreWind(wdir, normal); // samme dødzone som scoren og teksten

  // N og S på hver sin side af høfdens rod
  const nLabel = add(C, mul(tN, 30), mul(s, 14));
  const sLabel = add(C, mul(tN, -30), mul(s, 14));

  // vindpil: kommer ind fra vindsiden, lidt ude over vandet, peger med vinden
  const windSide = Math.sign(dot(vec(wdir), tN)) || 1;
  const wTail = add(C, mul(s, GROYNE * 0.6), mul(tN, windSide * 48), mul(vec(wdir), 34));
  const wHead = add(wTail, mul(dw, 48));
  const headL = add(wHead, mul(vec(wdir + 150), 11));
  const headR = add(wHead, mul(vec(wdir + 210), 11));
  const wLabel = add(wTail, mul(vec(wdir), 10));

  // bølger: to stiplede pile fra bølgeretningen, ude på havet
  const run = vec(swdir + 180); // bølgerne løber hen
  const waveBase = add(C, mul(s, 120));
  const waves = [-1, 1].map((k) => {
    const a = add(waveBase, mul(tN, k * 46), mul(vec(swdir), 30));
    return { a, b: add(a, mul(run, 40)) };
  });
  // etiketten lidt længere opstrøms end pilenes haler, så den ikke ligger på dem
  const waveLabel = add(waveBase, mul(vec(swdir), 48));

  const north = side === "nord";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="groyne-plan" aria-label="høfde set fra oven: land, høfde, vind, bølger og læ">
      {/* hav */}
      <rect x="0" y="0" width={W} height={H} fill="#0E2320" />
      {/* bølger */}
      {waves.map((w, i) => (
        <g key={i}>
          <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke={FG} strokeOpacity="0.7" strokeWidth="2" strokeDasharray="4 3" />
          <polygon points={`${pt(w.b)} ${pt(add(w.b, mul(vec(swdir + 150), 8)))} ${pt(add(w.b, mul(vec(swdir + 210), 8)))}`} fill={FG} fillOpacity="0.7" />
        </g>
      ))}
      <text x={waveLabel.x} y={waveLabel.y + 4} fill={MUTED} fontSize="11" fontWeight="700" textAnchor="middle" letterSpacing="1">
        BØLGER
      </text>
      {/* land */}
      <polygon points={land.map(pt).join(" ")} fill="#1A2C25" stroke={MUTED} strokeWidth="1" />
      {/* læ: vindskyggen bag høfden */}
      <polygon points={shadow.map(pt).join(" ")} fill={FG} fillOpacity="0.22" stroke={FG} strokeOpacity="0.9" strokeWidth="1.5" strokeDasharray="5 4" />
      {!thin && (
        <text x={leeLabel.x} y={leeLabel.y + 5} fill={FG} fontSize="14" fontWeight="800" textAnchor="middle" letterSpacing="1.5">
          LÆ
        </text>
      )}
      {thin && (
        <text x="12" y={H - 12} fill={FG} fontSize="11" fontWeight="800" letterSpacing="1">
          {offshore ? "FRALANDSVIND · LÆ OVERALT" : "INGEN LÆ FRA HØFDEN"}
        </text>
      )}
      {/* høfde */}
      <line x1={C.x} y1={C.y} x2={tip.x} y2={tip.y} stroke={FG} strokeWidth="7" strokeLinecap="round" />
      {/* siderne */}
      <text x={nLabel.x} y={nLabel.y + 5} fill={north ? FG : MUTED} fontSize="13" fontWeight="800" textAnchor="middle">
        N
      </text>
      <text x={sLabel.x} y={sLabel.y + 5} fill={north ? MUTED : FG} fontSize="13" fontWeight="800" textAnchor="middle">
        S
      </text>
      {/* vindpil */}
      <line x1={wTail.x} y1={wTail.y} x2={wHead.x} y2={wHead.y} stroke={FG} strokeWidth="3" />
      <polygon points={`${pt(wHead)} ${pt(headL)} ${pt(headR)}`} fill={FG} />
      <text x={wLabel.x} y={wLabel.y + 4} fill={FG} fontSize="11" fontWeight="800" textAnchor="middle" letterSpacing="1">
        VIND {fmt(wspd, 0)}
      </text>
      {/* nordmarkør */}
      <text x="12" y="20" fill={MUTED} fontSize="12" fontWeight="700">
        N ↑
      </text>
    </svg>
  );
}
