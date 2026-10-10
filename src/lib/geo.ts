// Geometri til kortet: små forskydninger i meter, pejlinger i skærm-
// koordinater og høfderækken som streger. Rigeligt præcist til høfder og
// pile på de zoomniveauer, kortet bruges på — ingen storcirkler her.

import type { SpotGeometry } from "../config/spots";

export interface LatLon {
  lat: number;
  lon: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
}

// Hele grader i 0..359.
export function normalizeDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

// Flyt et punkt distM meter i kompasretning bearing.
export function dest(lat: number, lon: number, bearing: number, distM: number): [number, number] {
  const r = (bearing * Math.PI) / 180;
  return [
    lat + (distM * Math.cos(r)) / 111320,
    lon + (distM * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180))
  ];
}

// Skærmpunkt distPx fra `from` i kompasretning bearing. Skærmens y vokser
// nedad, så nord er -y; Web Mercator er vinkeltro, så skærmvinkel =
// kompasvinkel.
export function pointAt(from: ScreenPoint, bearing: number, distPx: number): ScreenPoint {
  const r = (bearing * Math.PI) / 180;
  return { x: from.x + distPx * Math.sin(r), y: from.y - distPx * Math.cos(r) };
}

// Pejling (kompasgrader, 0..360) fra ét skærmpunkt til et andet.
export function bearingOnScreen(from: ScreenPoint, to: ScreenPoint): number {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

// Afstand i meter mellem to punkter — samme flade regning og samme
// meter-pr.-grad som dest(), så de to er hinandens omvendte. Nok til
// "prikken er flyttet 85 m".
export function distanceM(a: LatLon, b: LatLon): number {
  const midLat = (((a.lat + b.lat) / 2) * Math.PI) / 180;
  const dy = (b.lat - a.lat) * 111320;
  const dx = (b.lon - a.lon) * 111320 * Math.cos(midLat);
  return Math.sqrt(dx * dx + dy * dy);
}

export interface Groynes {
  count: number;
  spacingM: number;
  lengthM: number;
}

// Høfderækken: streger vinkelret på kysten (langs kystnormalen), fra 20 m
// inde på land til lengthM ud i havet, spacingM fra hinanden og centreret
// om spottet. Samme tegning som kortet altid har haft.
export function groyneLines(
  geo: SpotGeometry,
  g: Groynes
): [[number, number], [number, number]][] {
  const lines: [[number, number], [number, number]][] = [];
  const half = Math.floor(g.count / 2);
  for (let i = -half; i <= half; i++) {
    const [la, lo] = dest(geo.lat, geo.lon, geo.normal + 90, i * g.spacingM);
    lines.push([dest(la, lo, geo.normal + 180, 20), dest(la, lo, geo.normal, g.lengthM)]);
  }
  return lines;
}

// Høfdens læ (vindskyggen) på kortet: feltet bag høfden, set fra vinden —
// fra kysten ved prikken ud til høfdens spids, og derfra med vinden
// LEE_SHADOW_FACTOR × høfdens længde. Blæser vinden langs høfden (lige ind
// eller lige ud), bliver feltet smalt: så giver høfden ingen læ. Samme
// geometri som tegningen på NU (components/GroynePlan.tsx).
export const LEE_SHADOW_FACTOR = 0.8;

export function leeShadowLatLngs(
  geo: SpotGeometry,
  g: Groynes,
  wdir: number
): [number, number][] {
  const downwind = wdir + 180;
  const len = g.lengthM * LEE_SHADOW_FACTOR;
  const shore: [number, number] = [geo.lat, geo.lon];
  const tip = dest(geo.lat, geo.lon, geo.normal, g.lengthM);
  const tipDown = dest(tip[0], tip[1], downwind, len);
  // kystpunktet med vinden — men aldrig ind over land: komposanten ind mod
  // land fjernes, så punktet lander på kystlinjen
  let shoreDown = dest(geo.lat, geo.lon, downwind, len);
  const seaward = len * Math.cos(((downwind - geo.normal) * Math.PI) / 180);
  if (seaward < 0) shoreDown = dest(shoreDown[0], shoreDown[1], geo.normal, -seaward);
  return [shore, tip, tipDown, shoreDown];
}
