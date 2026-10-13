// KORT: Leaflet over tangen på mørke fliser. Nål pr. spot (farvet prik
// med score + navn) til det valgte tidspunkt, høfderne som streger
// vinkelret på kysten, målings-pletter i vandet, og en tidsskyder øverst,
// der scrubber time for time gennem 14 døgn — eller afspiller sig selv:
// én time hvert andet sekund, eller hurtigere for hvert tryk.
// "Tjek på kortet" (knappen på NU) zoomer ind på ét spot, så sted og
// retning kan bekræftes ved at trække i prikken og i pilespidsen.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useForecast } from "../hooks/useForecast";
import {
  SPOTS,
  AREAS,
  effectiveGeometry,
  configGeometry,
  confirmOnMap,
  type Area,
  type Spot,
  type SpotGeometry
} from "../config/spots";
import { hourlyBlocks, leeCaption, blockCaveats, nowLocalIso, type Block } from "../lib/blocks";
import { isOffshoreWind } from "../model/model";
import { scoreColor, scoreLabel, scoreTextColor, BG, FG, MUTED } from "../lib/colors";
import { fmtDayLabel, fmtClock } from "../lib/time";
import { fmt, fmtLevel, compass } from "../lib/format";
import { swellKind, swellLabel } from "../lib/swell";
import {
  bearingOnScreen,
  distanceM,
  groyneLines,
  groyneRoot,
  leeShadowLatLngs,
  normalizeDeg,
  pointAt
} from "../lib/geo";
import { Info } from "../components/Info";
import { ScreenHeader } from "../components/ScreenHeader";
import { WindArrow } from "../components/WindArrow";
import { CalibratePanel } from "../components/CalibratePanel";
import { SwellChip } from "../components/SwellChip";
import type { Row } from "../model/model";

// OpenStreetMaps egne fliser, gjort mørke med et CSS-filter på flise-
// laget (styles.css, .leaflet-tile-pane). Ingen nøgle, ingen tredjepart:
// CARTO's mørke fliser kræver API-nøgle (opdaget 14/09/2026).
const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

// Afspilning: ms pr. time for hvert tryk på knappen. Første tryk starter
// i det rolige tempo, de næste to sætter farten op, og det fjerde holder
// pause igen.
export const PLAY_STEPS_MS = [2000, 1000, 500] as const;
const PLAY_LABELS = ["1×", "2×", "4×"] as const;

// Tjek på kortet: zoom ind hertil, og pilens og kystlinjens længde på
// skærmen — i pixels uanset zoom, så pilespidsen altid kan nås.
const CHECK_ZOOM = 16;
const CHECK_ARROW_PX = 120;
const CHECK_COAST_PX = 110;

// Pile som på striben under skyderen: hel pil = vind, stiplet pil = bølger.
// Begge peger derhen, vinden blæser og bølgerne løber (retningen + 180).
function arrowSvg(fromDeg: number, size: number, dashed: boolean): string {
  const dash = dashed ? ' stroke-dasharray="2 1.4"' : "";
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 16 16" style="transform:rotate(${fromDeg + 180}deg)">` +
    `<line x1="8" y1="14.5" x2="8" y2="4" stroke="${FG}" stroke-width="${dashed ? 1.6 : 2.4}"${dash}/>` +
    `<path d="M8 1 L4.4 6.6 L8 5 L11.6 6.6 Z" fill="${FG}"/></svg>`
  );
}

// Mærket ground swell / wind swell som på NU (SwellChip) — her som HTML,
// fordi skilte og pile er Leaflet-ikoner.
function swellChipHtml(tp: number): string {
  const kind = swellKind(tp);
  return `<span class="swell-chip ${kind}">${swellLabel(kind)}</span>`;
}

// Vejr-skiltet for et område: navnet, vind (hel pil, m/s), bølger
// (stiplet pil, meter) og nederst ground/wind swell med perioden — ét
// objekt: skiltet hænger ud mod havet fra måleprikken, så det aldrig
// ligger over nålene (kysten er øst for prikken).
const SIGN_W = 164;
const SIGN_H = 94; // skal matche .sign i styles.css
const SIGN_STEM = 16;
const SIGN_DOT = 10;
function signHtml(area: Area, row: Row | null): string {
  const rows = row
    ? `<div class="sign-row">${arrowSvg(row.wdir, 24, false)}<span>${compass(row.wdir)} ${fmt(row.wspd, 0)} m/s</span></div>` +
      `<div class="sign-row">${arrowSvg(row.swdir, 24, true)}<span>${compass(row.swdir)} ${fmt(row.hs)} m</span></div>` +
      `<div class="sign-kind">${swellChipHtml(row.tp)}<span>${fmt(row.tp)} s</span></div>`
    : `<div class="sign-row sign-none">ingen data for timen</div>`;
  return (
    `<div class="sign"><div class="sign-card"><div class="sign-eyebrow">${area.label}</div>${rows}</div>` +
    `<span class="sign-stem"></span><span class="sign-dot"></span></div>`
  );
}
const signIcon = (area: Area, row: Row | null) =>
  L.divIcon({
    html: signHtml(area, row),
    className: "sign-wrap",
    iconSize: [SIGN_W + SIGN_STEM + SIGN_DOT, SIGN_H],
    // ankeret er måleprikken i højre side; skiltet hænger til venstre (vest)
    iconAnchor: [SIGN_W + SIGN_STEM + SIGN_DOT / 2, SIGN_H / 2]
  });

// Pilene ved et spot (fra ARROWS_ZOOM): vinden står dér, den kommer fra,
// bølgerne længere ude, dér de kommer fra, med ground/wind swell under —
// så de kan læses mod høfden og læ-feltet. Boksen er pixels om prikken, så
// afstanden holder i alle zoom.
const ARROW_BOX = 230;
function spotArrowsHtml(row: Row): string {
  const c = ARROW_BOX / 2;
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: c + r * Math.sin(a), y: c - r * Math.cos(a) };
  };
  const w = at(row.wdir, 60);
  const s = at(row.swdir, 96);
  return (
    `<div class="spot-arrows">` +
    `<div class="sa" style="left:${w.x.toFixed(0)}px;top:${w.y.toFixed(0)}px">${arrowSvg(row.wdir, 38, false)}<span>vind ${fmt(row.wspd, 0)} m/s</span></div>` +
    `<div class="sa" style="left:${s.x.toFixed(0)}px;top:${s.y.toFixed(0)}px">${arrowSvg(row.swdir, 38, true)}<span>bølger ${fmt(row.hs)} m</span>${swellChipHtml(row.tp)}</div>` +
    `</div>`
  );
}
const spotArrowsIcon = (row: Row | null) =>
  L.divIcon({
    html: row ? spotArrowsHtml(row) : "",
    className: "spot-arrows-wrap",
    iconSize: [ARROW_BOX, ARROW_BOX],
    iconAnchor: [ARROW_BOX / 2, ARROW_BOX / 2]
  });

// Spot-nålen: rund prik i scorefarven med tallet i, og navnet ved siden af.
// Under et tjek får prikken en ring, så man kan se, at den kan trækkes.
function pinIcon(spot: Spot, block: Block | null, checking = false): L.DivIcon {
  const color = block ? scoreColor(block.score) : MUTED;
  const text = block ? scoreTextColor(block.score) : FG;
  const cls = "spot-dot" + (spot.uncalibrated ? " uncal" : "") + (checking ? " cal" : "");
  const html =
    `<div class="spot-pin">` +
    `<span class="${cls}" style="background:${color};color:${text}">` +
    `${block ? fmt(block.score) : "–"}</span>` +
    `<span class="spot-name">${spot.shortName}</span></div>`;
  // Boksen er selve prikken (34 px); navnet får lov at stikke ud til højre.
  return L.divIcon({ html, className: "spot-pin-wrap", iconSize: [34, 34], iconAnchor: [17, 17] });
}

// Pilespidsen, der trækkes rundt om prikken under et tjek. Peger i
// kystnormalens retning. Drejes bagefter med CSS på svg'et — aldrig med
// setIcon, for et nyt ikon midt i et træk afbryder trækket.
function handleIcon(normal: number): L.DivIcon {
  const html =
    `<svg width="44" height="44" viewBox="0 0 44 44" style="transform:rotate(${normal}deg)">` +
    `<circle cx="22" cy="22" r="20" fill="${BG}" fill-opacity="0.55"/>` +
    `<path d="M22 5 L34 31 L22 25 L10 31 Z" fill="${FG}" stroke="${BG}" stroke-width="2" stroke-linejoin="round"/>` +
    `</svg>`;
  return L.divIcon({ html, className: "cal-handle", iconSize: [44, 44], iconAnchor: [22, 22] });
}

function popupHtml(spot: Spot, block: Block | null): string {
  const name = spot.uncalibrated ? `${spot.shortName} (ukalibreret)` : spot.shortName;
  if (!block) return `<strong>${name}</strong><br>hul i data`;
  const b = block;
  const warn = blockCaveats(spot, b);
  return (
    `<strong>${name}</strong><br>` +
    `<span style="font-size:20px;font-weight:800;color:${scoreColor(b.score)}">${fmt(b.score)}</span>` +
    ` — ${scoreLabel(b.score)}<br>` +
    `${leeCaption(spot, b)} · ${fmt(b.row.hs)} m / ${fmt(b.row.tp)} s · ` +
    swellLabel(swellKind(b.row.tp)).toLowerCase() +
    (warn.length ? `<br>⚠ ${warn.map((c) => c.short).join(" · ")}` : "")
  );
}

// Høfderækken for ét spot, tegnet efter det effektive sted og den effektive
// retning. Tegnes om, når de ændrer sig (under og efter et tjek); findes
// stregerne allerede, flyttes de bare.
function drawGroynes(
  map: L.Map,
  store: Map<string, L.Polyline[]>,
  spot: Spot,
  geo: SpotGeometry
): void {
  const lines = spot.groynes ? groyneLines(geo, spot.groynes) : [];
  const existing = store.get(spot.id) ?? [];
  if (existing.length === lines.length) {
    existing.forEach((pl, i) => pl.setLatLngs(lines[i]));
    return;
  }
  for (const pl of existing) pl.remove();
  store.set(
    spot.id,
    lines.map((ll) =>
      L.polyline(ll, { color: FG, weight: 3, opacity: 0.85, interactive: false }).addTo(map)
    )
  );
}

// Første time i tidslinjen, der ikke er passeret — skyderens startsted.
function indexOfNow(timeline: string[]): number {
  const now = nowLocalIso();
  const i = timeline.findIndex((t) => t >= now);
  return i === -1 ? Math.max(0, timeline.length - 1) : i;
}

function WaveArrow({ deg, size = 18 }: { deg: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" style={{ transform: `rotate(${deg + 180}deg)` }}>
      <line x1="8" y1="14" x2="8" y2="3.5" stroke={FG} strokeWidth="1.6" strokeDasharray="2 1.4" />
      <path d="M8 1 L4.6 6.4 L8 4.8 L11.4 6.4 Z" fill={FG} />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4.5 2.5 L13.5 8 L4.5 13.5 Z" fill="currentColor" />
    </svg>
  );
}

function MapHelp() {
  return (
    <>
      <Info q="Sådan bruger du kortet">
        <p>
          <strong>Træk i skyderen</strong> for at spole <strong>time for time</strong> gennem 7
          døgn frem og 7 tilbage. Dagen og klokkeslættet står ovenover, og prikkerne skifter tal
          og farve med. I en flad uge rykker tallene sig kun lidt; det er havet, ikke kortet, der
          står stille.
        </p>
        <p>
          <strong>Afspil-knappen</strong> ved klokkeslættet spoler selv: ét tryk giver én time
          frem hvert andet sekund, andet og tredje tryk sætter farten op (2× og 4×), og fjerde
          tryk holder pause. Knappen viser farten. Skyderen og pilene virker stadig imens, den
          stopper selv ved enden af tidslinjen, og er du nået dertil, starter den forfra fra nu.
        </p>
        <p>
          <strong>Tallet i prikken</strong> er spottets score (0–10) på det valgte tidspunkt,
          med samme farver som alle andre steder i appen. <strong>Tryk på en prik</strong> for
          dom, læside og bølgetal.
        </p>
        <p>
          <strong>Skiltene ude i vandet</strong> er områdets vejrmåling: vind (hel pil, m/s),
          bølger (stiplet pil, meter) og nederst, om det er <strong>ground swell</strong> eller{" "}
          <strong>wind swell</strong>, med perioden i sekunder (fra 8 s er det ground swell) —
          alt til det valgte tidspunkt. Pilene peger derhen, vinden blæser og bølgerne løber.
          Prikken er dér, tallene måles; ét skilt pr. vejr-område, ikke et kort over hele havet.{" "}
          <strong>Fra zoom 15</strong> står de samme to pile ved hvert spot, så de kan læses mod
          høfden og læ-feltet: vinden dér, den kommer fra, bølgerne længere ude med mærket under.
        </p>
        <p>
          Linjen under skyderen viser vind og bølge pr. vejr-område til det valgte tidspunkt. En{" "}
          <strong>stiplet ring</strong> betyder ukalibreret spot. De små lyse streger er
          høfderne, og det <strong>lyse felt</strong> ved en høfde er dens læ: vindskyggen bag
          den til det valgte tidspunkt (fra zoom 13 står der LÆ i det). Blæser vinden langs
          høfden, bliver feltet smalt — så giver høfden ingen læ. Kortudsnit, du har set, virker
          også uden net.
        </p>
      </Info>
      <Info q="Tjek sted og retning på kortet">
        <p>
          Knappen <strong>Tjek på kortet</strong> på NU zoomer ind på spottet: en ring om
          prikken, en pil, der peger den vej spottet vender, og en stiplet streg langs kysten.
          <strong> Prikken skal stå på høfdens spids</strong>, den yderste ende — høfden tegnes
          derfra ind mod land, og læet regnes af den. Træk pilespidsen (eller brug − og +), til
          pilen peger ud mod havet og stregen ligger langs kysten — og høfde-stregerne oven i
          de rigtige høfder.
        </p>
        <p>
          <strong>Bekræft</strong> gemmer sted og retning på telefonen, NU viser spottet som
          bekræftet, og scoren regner med den nye retning med det samme. Annullér smider
          ændringerne væk. Begge dele sender dig tilbage til NU.
        </p>
      </Info>
    </>
  );
}

interface Props {
  checkSpotId: string | null; // spottet der tjekkes (fra NU), ellers null
  onCheckDone: () => void; // bekræftet eller annulleret → App går tilbage til NU
}

export function MapScreen({ checkSpotId, onCheckDone }: Props) {
  const { forecast } = useForecast();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const groynesRef = useRef<Map<string, L.Polyline[]>>(new Map());
  const leeRef = useRef<Map<string, L.Polygon>>(new Map()); // høfdens læ pr. spot
  const signsRef = useRef<Map<string, L.Marker>>(new Map()); // vejr-skilt pr. område
  const arrowsRef = useRef<Map<string, L.Marker>>(new Map()); // vind- og bølgepile pr. spot

  // Timescorer pr. spot + fælles timevis tidslinje (skyderen kører 1 time
  // pr. skridt hen over alle 14 dage)
  const perSpot = useMemo(() => {
    if (!forecast) return new Map<string, Map<string, Block>>();
    const m = new Map<string, Map<string, Block>>();
    for (const spot of SPOTS) m.set(spot.id, hourlyBlocks(forecast, spot));
    return m;
  }, [forecast]);

  const timeline = useMemo(() => {
    const all = new Set<string>();
    for (const bm of perSpot.values()) for (const t of bm.keys()) all.add(t);
    return [...all].sort();
  }, [perSpot]);

  const [idx, setIdx] = useState(-1); // -1 = ikke sat endnu
  useEffect(() => {
    if (idx === -1 && timeline.length > 0) setIdx(indexOfNow(timeline));
  }, [timeline, idx]);

  const time = idx >= 0 && idx < timeline.length ? timeline[idx] : null;

  // Vind og bølge pr. vejr-område til det valgte tidspunkt.
  const areaRows = useMemo(() => {
    if (!forecast || !time) return [] as { label: string; row: Row }[];
    return AREAS.flatMap((a) => {
      const row = forecast.areas[a.id]?.rows.find((r) => r.time === time);
      return row ? [{ label: a.label, row }] : [];
    });
  }, [forecast, time]);

  // ---- Tjek på kortet: sted og retning, der trækkes på, men ikke er gemt.
  const checkSpot = useMemo(() => SPOTS.find((s) => s.id === checkSpotId) ?? null, [checkSpotId]);
  const [check, setCheck] = useState<SpotGeometry | null>(null);
  const checkRef = useRef<SpotGeometry | null>(null);
  const layoutRef = useRef<(() => void) | null>(null);
  const handleDragRef = useRef(false); // pilespidsen er i hånden — flyt den ikke selv

  useEffect(() => {
    setCheck(checkSpot ? effectiveGeometry(checkSpot) : null);
  }, [checkSpot]);

  // Lagene på kortet følger sted og retning, så snart de ændrer sig.
  useEffect(() => {
    checkRef.current = check;
    layoutRef.current?.();
  }, [check]);

  // ---- Afspilning: trin i PLAY_STEPS_MS (-1 = pause). Stopper ved enden.
  const [playStep, setPlayStep] = useState(-1);
  const playing = playStep >= 0;
  const atEnd = idx >= timeline.length - 1;
  useEffect(() => {
    if (!playing || checkSpot) return;
    const id = window.setInterval(
      () => setIdx((i) => Math.min(timeline.length - 1, i + 1)),
      PLAY_STEPS_MS[playStep]
    );
    return () => window.clearInterval(id);
  }, [playing, playStep, checkSpot, timeline.length]);
  useEffect(() => {
    if (playing && atEnd) setPlayStep(-1);
  }, [playing, atEnd]);
  // Ét tryk: afspil. Andet og tredje: hurtigere. Fjerde: pause.
  const cyclePlay = () => {
    if (playStep >= PLAY_STEPS_MS.length - 1) {
      setPlayStep(-1);
      return;
    }
    if (!playing && atEnd) setIdx(indexOfNow(timeline)); // forfra fra nu
    setPlayStep((s) => s + 1);
  };
  const playLabel = !playing
    ? "afspil, én time frem hvert andet sekund"
    : playStep < PLAY_STEPS_MS.length - 1
      ? `hurtigere, nu ${PLAY_LABELS[playStep]}`
      : "pause";

  // Kortet oprettes én gang — når der er et element at sætte det i (uden
  // cache findes elementet først, når forecasten er hentet).
  const hasForecast = forecast !== null;
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });

    // Spot-navne kun når der er zoomet ind nok til, at de ikke ligger oven
    // i hinanden (Thyborøn-spottene ligger inden for få km); LÆ-mærket på
    // læ-felterne et trin senere.
    const NAME_ZOOM = 12;
    const LEE_ZOOM = 13;
    const ARROWS_ZOOM = 15; // pile ved spottet: tæt nok på til, at nabospots ikke ligger oven i
    const updateNames = () => {
      const z = map.getZoom();
      map.getContainer().classList.toggle("names-on", z >= NAME_ZOOM);
      map.getContainer().classList.toggle("lee-on", z >= LEE_ZOOM);
      map.getContainer().classList.toggle("arrows-on", z >= ARROWS_ZOOM);
    };
    map.on("zoomend", updateNames);

    const geos = new Map<string, SpotGeometry>();
    for (const s of SPOTS) geos.set(s.id, effectiveGeometry(s));

    // Måleprikken pr. område: ~2,5 km ud for midten af områdets spots.
    // Skiltet hænger videre ud mod vest fra den.
    const anchors = new Map<string, [number, number]>();
    for (const a of AREAS) {
      const areaGeos = SPOTS.filter((s) => s.area === a.id).map((s) => geos.get(s.id) as SpotGeometry);
      if (areaGeos.length === 0) continue;
      const lat = areaGeos.reduce((acc, g) => acc + g.lat, 0) / areaGeos.length;
      const lon = areaGeos.reduce((acc, g) => acc + g.lon, 0) / areaGeos.length - 0.04;
      anchors.set(a.id, [lat, lon]);
    }

    // Indram alle spots + måleprikker — med plads i vest til skiltene, der
    // hænger ud fra prikkerne.
    map.fitBounds(
      L.latLngBounds([
        ...[...geos.values()].map((g) => [g.lat, g.lon] as [number, number]),
        ...anchors.values()
      ]),
      { paddingTopLeft: [SIGN_W + SIGN_STEM + 12, 16], paddingBottomRight: [16, 16] }
    );

    L.tileLayer(TILE_URL, { maxZoom: 19, attribution: TILE_ATTR }).addTo(map);

    for (const a of AREAS) {
      const anchor = anchors.get(a.id);
      if (!anchor) continue;
      signsRef.current.set(
        a.id,
        L.marker(anchor, { icon: signIcon(a, null), interactive: false, keyboard: false }).addTo(map)
      );
    }

    for (const spot of SPOTS) {
      const geo = geos.get(spot.id) as SpotGeometry;
      // Læ-feltet lægges FØR høfderne, så stregerne tegnes ovenpå. Formen
      // sættes af effekten nedenfor (den følger tidsskyderen).
      if (spot.groynes) {
        const lee = L.polygon([], {
          className: "lee-shadow",
          color: FG,
          weight: 1.5,
          opacity: 0.9,
          dashArray: "4 4",
          fillColor: FG,
          fillOpacity: 0.26,
          interactive: false
        });
        lee.bindTooltip("LÆ", { permanent: true, direction: "center", className: "lee-tip" });
        leeRef.current.set(spot.id, lee);
      }
      drawGroynes(map, groynesRef.current, spot, geo);
      arrowsRef.current.set(
        spot.id,
        L.marker([geo.lat, geo.lon], {
          icon: spotArrowsIcon(null),
          interactive: false,
          keyboard: false,
          zIndexOffset: -500
        }).addTo(map)
      );
      const marker = L.marker([geo.lat, geo.lon], { icon: pinIcon(spot, null) }).addTo(map);
      marker.bindPopup("", { closeButton: false, offset: [0, -12] });
      markersRef.current.set(spot.id, marker);
    }
    updateNames();
    // Toppen skifter højde (skyder ↔ tjek-panel), og Leaflet lytter kun på
    // vinduet — så fortæl den selv, når beholderen ændrer størrelse.
    const ro = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    ro.observe(mapEl.current);
    mapRef.current = map;
    setMapReady(true);
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      arrowsRef.current.clear();
      groynesRef.current.clear();
      leeRef.current.clear();
      signsRef.current.clear();
      setMapReady(false);
    };
  }, [hasForecast]);

  // Vejr-skiltene og pilene følger tidsskyderen: skiltet pr. område og
  // pilene ved hvert spot viser vind og bølger til det valgte tidspunkt.
  // Uden data for timen siger skiltet det, og pilene står tomme.
  useEffect(() => {
    if (!forecast || !time) return;
    for (const a of AREAS) {
      const sign = signsRef.current.get(a.id);
      if (!sign) continue;
      const row = forecast.areas[a.id]?.rows.find((r) => r.time === time) ?? null;
      sign.setIcon(signIcon(a, row));
    }
    for (const spot of SPOTS) {
      const arrows = arrowsRef.current.get(spot.id);
      if (!arrows) continue;
      const row = forecast.areas[spot.area]?.rows.find((r) => r.time === time) ?? null;
      arrows.setIcon(spotArrowsIcon(row));
    }
  }, [forecast, time, mapReady]);

  // Høfdernes læ følger tidsskyderen (vinden til det valgte tidspunkt) og
  // under et tjek også den retning, der trækkes på. Uden vind for timen
  // tages feltet af kortet — et felt uden grundlag er ikke læ. Ved
  // fralandsvind er hele kysten i læ, og høfdens skygge ville pege ud over
  // havet: så tages feltet også af (samme dødzone som scoren).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !forecast || !time) return;
    for (const spot of SPOTS) {
      const lee = leeRef.current.get(spot.id);
      if (!lee || !spot.groynes) continue;
      const row = forecast.areas[spot.area]?.rows.find((r) => r.time === time);
      const geo = checkSpot && check && checkSpot.id === spot.id ? check : effectiveGeometry(spot);
      if (!row || isOffshoreWind(row.wdir, geo.normal)) {
        if (map.hasLayer(lee)) lee.remove();
        continue;
      }
      lee.setLatLngs(leeShadowLatLngs(geo, spot.groynes, row.wdir));
      if (!map.hasLayer(lee)) lee.addTo(map);
      lee.getTooltip()?.setLatLng(lee.getCenter());
    }
  }, [forecast, time, mapReady, check, checkSpot]);

  // Nåle og popups følger tidsskyderen (og ringen følger tjekket)
  useEffect(() => {
    if (!time) return;
    for (const spot of SPOTS) {
      const marker = markersRef.current.get(spot.id);
      if (!marker) continue;
      const block = perSpot.get(spot.id)?.get(time) ?? null;
      marker.setIcon(pinIcon(spot, block, spot.id === checkSpotId));
      marker.setPopupContent(popupHtml(spot, block));
    }
  }, [time, perSpot, checkSpotId, mapReady]);

  // Tjek på kortet: zoom ind, gør prikken trækbar, og læg pil, kystlinje og
  // pilespids ovenpå. Alt regnes i skærm-pixels ud fra prikken, så pilen
  // er lige lang uanset zoom. Ryddes op igen, når tjekket slutter.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !checkSpot) return;
    const spot = checkSpot;
    const marker = markersRef.current.get(spot.id);
    if (!marker) return;

    const start = effectiveGeometry(spot);
    map.setView([start.lat, start.lon], Math.max(map.getZoom(), CHECK_ZOOM));
    marker.dragging?.enable();

    const shaftBack = L.polyline([], { color: BG, weight: 7, opacity: 0.6, interactive: false }).addTo(map);
    const shaft = L.polyline([], { color: FG, weight: 3, interactive: false }).addTo(map);
    const coast = L.polyline([], {
      color: FG,
      weight: 2,
      opacity: 0.85,
      dashArray: "6 6",
      interactive: false
    }).addTo(map);
    const handle = L.marker([start.lat, start.lon], {
      icon: handleIcon(start.normal),
      draggable: true,
      keyboard: false,
      zIndexOffset: 1000
    }).addTo(map);

    const layout = () => {
      const c = checkRef.current;
      if (!c) return;
      const pin = L.latLng(c.lat, c.lon);
      if (!marker.getLatLng().equals(pin)) marker.setLatLng(pin);
      arrowsRef.current.get(spot.id)?.setLatLng(pin);
      const p = map.latLngToContainerPoint(pin);
      const at = (from: L.Point, bearing: number, px: number) => {
        const q = pointAt(from, bearing, px);
        return map.containerPointToLatLng(L.point(q.x, q.y));
      };
      const tip = at(p, c.normal, CHECK_ARROW_PX);
      shaftBack.setLatLngs([pin, tip]);
      shaft.setLatLngs([pin, tip]);
      // kystlinjen ligger ved høfdens rod — prikken står på spidsen
      const shore = spot.groynes ? map.latLngToContainerPoint(groyneRoot(c, spot.groynes)) : p;
      coast.setLatLngs([at(shore, c.normal + 90, CHECK_COAST_PX), at(shore, c.normal - 90, CHECK_COAST_PX)]);
      const svg = handle.getElement()?.querySelector("svg");
      if (svg) svg.style.transform = `rotate(${c.normal}deg)`;
      if (!handleDragRef.current) handle.setLatLng(tip);
      drawGroynes(map, groynesRef.current, spot, c);
    };
    layoutRef.current = layout;
    layout();

    const onPinDrag = () => {
      const ll = marker.getLatLng();
      setCheck((c) => (c ? { ...c, lat: ll.lat, lon: ll.lng } : c));
    };
    const onHandleDragStart = () => {
      handleDragRef.current = true;
    };
    const onHandleDrag = () => {
      const deg = normalizeDeg(
        bearingOnScreen(
          map.latLngToContainerPoint(marker.getLatLng()),
          map.latLngToContainerPoint(handle.getLatLng())
        )
      );
      setCheck((c) => (c && c.normal !== deg ? { ...c, normal: deg } : c));
    };
    const onHandleDragEnd = () => {
      handleDragRef.current = false;
      layout(); // pilespidsen tilbage på pilens ende
    };
    marker.on("drag", onPinDrag);
    handle.on("dragstart", onHandleDragStart);
    handle.on("drag", onHandleDrag);
    handle.on("dragend", onHandleDragEnd);
    map.on("zoomend", layout); // pixel-længderne skal regnes om

    return () => {
      marker.off("drag", onPinDrag);
      handle.off("dragstart", onHandleDragStart);
      handle.off("drag", onHandleDrag);
      handle.off("dragend", onHandleDragEnd);
      map.off("zoomend", layout);
      layoutRef.current = null;
      handleDragRef.current = false;
      marker.dragging?.disable();
      shaftBack.remove();
      shaft.remove();
      coast.remove();
      handle.remove();
      // Lever kortet stadig, står prikken og høfderne tilbage på det gemte
      // (bekræftet eller ej); er kortet fjernet, er der intet at stille.
      if (mapRef.current === map) {
        const saved = effectiveGeometry(spot);
        marker.setLatLng([saved.lat, saved.lon]);
        arrowsRef.current.get(spot.id)?.setLatLng([saved.lat, saved.lon]);
        drawGroynes(map, groynesRef.current, spot, saved);
      }
    };
  }, [mapReady, checkSpot]);

  const header = (
    <ScreenHeader
      right={
        <a href="https://app.fcoo.dk/ifm-maps/" target="_blank" rel="noopener noreferrer">
          FCOO-søkort ↗
        </a>
      }
      help={<MapHelp />}
    />
  );

  if (!forecast) {
    return (
      <div className="screen">
        {header}
        <p className="statusline">Henter forecast …</p>
      </div>
    );
  }

  return (
    <div className="map-screen">
      <div className="map-top">
        {header}
        {checkSpot && check ? (
          <CalibratePanel
            spot={checkSpot}
            geo={check}
            movedM={distanceM(effectiveGeometry(checkSpot), check)}
            isAppValue={
              check.lat === checkSpot.lat &&
              check.lon === checkSpot.lon &&
              check.normal === checkSpot.shoreNormal
            }
            onTurn={(d) => setCheck((c) => (c ? { ...c, normal: normalizeDeg(c.normal + d) } : c))}
            onReset={() => setCheck(configGeometry(checkSpot))}
            onConfirm={() => {
              confirmOnMap(checkSpot, check);
              onCheckDone();
            }}
            onCancel={onCheckDone}
          />
        ) : (
          <>
            <div className="timeslider-label">
              <span>
                {time ? (
                  <>
                    <strong>{fmtDayLabel(time)}</strong> kl. {fmtClock(time)}
                  </>
                ) : (
                  "—"
                )}
              </span>
              <button
                className={"play-btn" + (playing ? " on" : "")}
                onClick={cyclePlay}
                disabled={timeline.length < 2}
                aria-pressed={playing}
                aria-label={playLabel}
              >
                {playing ? <span className="play-speed">{PLAY_LABELS[playStep]}</span> : <PlayIcon />}
              </button>
            </div>
            <div className="slider-row">
              <button
                className="step-btn"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx <= 0}
                aria-label="én time tilbage"
              >
                ‹
              </button>
              <input
                type="range"
                min={0}
                max={Math.max(0, timeline.length - 1)}
                value={Math.max(0, idx)}
                onChange={(e) => setIdx(Number(e.target.value))}
                aria-label="tidsskyder, time for time"
              />
              <button
                className="step-btn"
                onClick={() => setIdx((i) => Math.min(timeline.length - 1, i + 1))}
                disabled={idx >= timeline.length - 1}
                aria-label="én time frem"
              >
                ›
              </button>
            </div>
            {areaRows.length > 0 && (
              <div className="area-strip" aria-label="vind, bølge og bølgetype pr. område">
                {areaRows.map(({ label, row }) => (
                  <div className="area-cell" key={label}>
                    <div className="area-lab">{label}</div>
                    <div className="area-vals">
                      <span className="area-val">
                        <WindArrow deg={row.wdir} spd={row.wspd} size={18} />
                        {compass(row.wdir)} {fmt(row.wspd, 0)} m/s
                      </span>
                      <span className="area-val">
                        <WaveArrow deg={row.swdir} />
                        {compass(row.swdir)} {fmt(row.hs)} m
                      </span>
                      <span className="area-val area-kind">
                        <SwellChip tp={row.tp} />
                        {fmt(row.tp)} s
                      </span>
                      {row.level != null && (
                        <span className="area-val area-kind">vandstand {fmtLevel(row.level)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      <div className="map-body">
        <div ref={mapEl} className="map-el" />
      </div>
    </div>
  );
}
