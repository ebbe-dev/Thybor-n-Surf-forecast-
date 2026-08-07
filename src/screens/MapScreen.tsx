// KORT: Leaflet over tangen. Markør pr. spot farvet efter score til det
// valgte tidspunkt, høfderne som streger vinkelret på kysten, og en
// tidsskyder øverst der scrubber de 7 døgn.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, AREAS, type Spot } from "../config/spots";
import { hourlyBlocks, nowLocalIso, type Block } from "../lib/blocks";
import { scoreColor, scoreLabel, BG, FG, MUTED } from "../lib/colors";
import { fmtDayLabel, fmtClock } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { Info } from "../components/Info";
import { WindArrow } from "../components/WindArrow";
import type { Row } from "../model/model";

// Vandfarve efter bølgehøjde — blå (småt) mod hvidligt skum (stort).
// Egen skala, adskilt fra scorefarverne (samme farve = samme betydning
// gælder stadig for score).
function waveColor(hs: number): string {
  if (hs >= 2.5) return "#EAF5F2";
  if (hs >= 1.5) return "#7ED4C9";
  if (hs >= 1.0) return "#37B6C4";
  if (hs >= 0.5) return "#3E9BC0";
  return "#4A7FB5";
}

// Pil (SVG) der peger derhen bølgerne løber (swdir + 180), til divIcon.
function waveArrowHtml(swdir: number): string {
  return (
    `<svg width="26" height="26" viewBox="0 0 16 16" style="transform:rotate(${swdir + 180}deg)">` +
    `<line x1="8" y1="14" x2="8" y2="4" stroke="#0B1917" stroke-width="2"/>` +
    `<path d="M8 1 L4.4 6.6 L8 5 L11.6 6.6 Z" fill="#0B1917"/></svg>`
  );
}

// Flyt et punkt distM meter i kompasretning bearing. Rigeligt præcist
// til høfde-streger på dette zoomniveau.
function dest(lat: number, lon: number, bearing: number, distM: number): [number, number] {
  const r = (bearing * Math.PI) / 180;
  return [
    lat + (distM * Math.cos(r)) / 111320,
    lon + (distM * Math.sin(r)) / (111320 * Math.cos((lat * Math.PI) / 180))
  ];
}

interface SpotAtTime {
  spot: Spot;
  block: Block | null;
}

function popupHtml(s: SpotAtTime): string {
  const name = s.spot.uncalibrated ? `${s.spot.shortName} (UKALIBRERET)` : s.spot.shortName;
  if (!s.block) return `<strong>${name}</strong><br>hul i data`;
  const b = s.block;
  return (
    `<strong>${name}</strong><br>` +
    `<span style="font-size:20px;font-weight:800;color:${scoreColor(b.score)}">${fmt(b.score)}</span>` +
    ` — ${scoreLabel(b.score)}<br>` +
    `læ på ${b.side}siden · ${fmt(b.row.hs)} m / ${fmt(b.row.tp)} s`
  );
}

export function MapScreen() {
  const { forecast } = useForecast();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const patchesRef = useRef<Map<string, { circle: L.Circle; arrows: L.Marker[] }>>(new Map());

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
  // Viser-kassen kan foldes helt eller pr. område — og husker valget.
  const [windOpen, setWindOpen] = useState(() => localStorage.getItem("bygtangen.mapwind") !== "0");
  const [closedAreas, setClosedAreas] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem("bygtangen.mapwind.closed") ?? "[]") as string[];
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  });

  function toggleWind() {
    setWindOpen((o) => {
      localStorage.setItem("bygtangen.mapwind", o ? "0" : "1");
      return !o;
    });
  }

  function toggleArea(label: string) {
    setClosedAreas((prev) => {
      const next = prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label];
      localStorage.setItem("bygtangen.mapwind.closed", JSON.stringify(next));
      return next;
    });
  }
  useEffect(() => {
    if (idx === -1 && timeline.length > 0) {
      const now = nowLocalIso();
      const i = timeline.findIndex((t) => t >= now);
      setIdx(i === -1 ? timeline.length - 1 : i);
    }
  }, [timeline, idx]);

  const time = idx >= 0 && idx < timeline.length ? timeline[idx] : null;

  // Vind og bølge pr. vejr-område til det valgte tidspunkt — én viser-linje
  // pr. område, ikke en pil pr. spot.
  const areaRows = useMemo(() => {
    if (!forecast || !time) return [] as { label: string; row: Row }[];
    return AREAS.flatMap((a) => {
      const row = forecast.areas[a.id]?.rows.find((r) => r.time === time);
      return row ? [{ label: a.label, row }] : [];
    });
  }, [forecast, time]);

  // Kortet oprettes én gang
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });

    // Målings-pletter ude i vandet: ~2,5 km vest for områdets spots.
    const anchors = new Map<string, [number, number]>();
    for (const a of AREAS) {
      const areaSpots = SPOTS.filter((s) => s.area === a.id);
      if (areaSpots.length === 0) continue;
      const lat = areaSpots.reduce((acc, s) => acc + s.lat, 0) / areaSpots.length;
      const lon = areaSpots.reduce((acc, s) => acc + s.lon, 0) / areaSpots.length - 0.09;
      anchors.set(a.id, [lat, lon]);
    }

    // Indram alle spots + målings-pletter
    map.fitBounds(
      L.latLngBounds([
        ...SPOTS.map((s) => [s.lat, s.lon] as [number, number]),
        ...anchors.values()
      ]).pad(0.1)
    );

    for (const a of AREAS) {
      const anchor = anchors.get(a.id);
      if (!anchor) continue;
      const circle = L.circle(anchor, {
        radius: 2200,
        color: "#0B1917",
        weight: 1,
        opacity: 0.5,
        fillColor: "#4A7FB5",
        fillOpacity: 0.55
      }).addTo(map);
      circle.bindTooltip("", { permanent: true, direction: "center", className: "wave-tip" });
      const arrows = [
        [0.010, 0.013],
        [-0.011, -0.010]
      ].map(([dlat, dlon]) =>
        L.marker([anchor[0] + dlat, anchor[1] + dlon], {
          icon: L.divIcon({ html: "", className: "wave-arrow", iconSize: [26, 26] }),
          interactive: false,
          keyboard: false
        }).addTo(map)
      );
      patchesRef.current.set(a.id, { circle, arrows });
    }
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 17,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    for (const spot of SPOTS) {
      // Høfderækken: streger vinkelret på kysten (langs kystnormalen).
      if (spot.groynes) {
        const { count, spacingM, lengthM } = spot.groynes;
        const half = Math.floor(count / 2);
        for (let i = -half; i <= half; i++) {
          const [la, lo] = dest(spot.lat, spot.lon, spot.shoreNormal + 90, i * spacingM);
          const inner = dest(la, lo, spot.shoreNormal + 180, 20);
          const outer = dest(la, lo, spot.shoreNormal, lengthM);
          L.polyline([inner, outer], { color: FG, weight: 3, opacity: 0.85 }).addTo(map);
        }
      }
      const marker = L.circleMarker([spot.lat, spot.lon], {
        radius: 16,
        color: BG,
        weight: 3,
        fillColor: MUTED,
        fillOpacity: 1
      }).addTo(map);
      marker.bindPopup("", { closeButton: false });
      // Score-tallet oven på prikken: i en flad uge skifter farvebåndet
      // sjældent, men tallet skal altid bevæge sig når man scrubber.
      marker.bindTooltip("", { permanent: true, direction: "center", className: "score-tip" });
      markersRef.current.set(spot.id, marker);
    }
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current.clear();
      patchesRef.current.clear();
    };
  }, []);

  // Målings-pletterne følger tidsskyderen: vandfarve = bølgehøjde,
  // pile = bølgeretning, tallet = højden.
  useEffect(() => {
    if (!forecast || !time) return;
    for (const a of AREAS) {
      const patch = patchesRef.current.get(a.id);
      if (!patch) continue;
      const row = forecast.areas[a.id]?.rows.find((r) => r.time === time) ?? null;
      if (!row) {
        patch.circle.setStyle({ fillColor: "#888888", fillOpacity: 0.15, opacity: 0.25 });
        patch.circle.setTooltipContent("–");
        for (const ar of patch.arrows)
          ar.setIcon(L.divIcon({ html: "", className: "wave-arrow", iconSize: [26, 26] }));
        continue;
      }
      patch.circle.setStyle({
        fillColor: waveColor(row.hs),
        fillOpacity: 0.55,
        opacity: 0.5
      });
      patch.circle.setTooltipContent(`${fmt(row.hs)} m`);
      for (const ar of patch.arrows)
        ar.setIcon(
          L.divIcon({ html: waveArrowHtml(row.swdir), className: "wave-arrow", iconSize: [26, 26] })
        );
    }
  }, [forecast, time]);

  // Farver og popups følger tidsskyderen
  useEffect(() => {
    if (!time) return;
    for (const spot of SPOTS) {
      const marker = markersRef.current.get(spot.id);
      if (!marker) continue;
      const block = perSpot.get(spot.id)?.get(time) ?? null;
      marker.setStyle({
        fillColor: block ? scoreColor(block.score) : MUTED,
        fillOpacity: block ? 1 : 0.5,
        dashArray: spot.uncalibrated ? "3 4" : undefined,
        color: spot.uncalibrated ? MUTED : BG
      });
      marker.setPopupContent(popupHtml({ spot, block }));
      // mørk tekst på de lyse bånd, lys tekst på de mørke
      const tipColor = block ? (block.score >= 3.5 ? BG : FG) : MUTED;
      marker.setTooltipContent(
        `<span style="color:${tipColor}">${block ? fmt(block.score) : "–"}</span>`
      );
    }
  }, [time, perSpot]);

  if (!forecast) {
    return (
      <div className="screen">
        <p className="statusline">Henter forecast …</p>
      </div>
    );
  }

  return (
    <div className="map-screen">
      <div className="timeslider">
        <div className="timeslider-label">
          {time ? (
            <>
              <strong>{fmtDayLabel(time)}</strong> kl. {fmtClock(time)}
            </>
          ) : (
            "—"
          )}
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(0, timeline.length - 1)}
          value={Math.max(0, idx)}
          onChange={(e) => setIdx(Number(e.target.value))}
          aria-label="tidsskyder over 7 døgn"
        />
        <Info q="Sådan bruger du kortet">
          <p>
            <strong>Træk i skyderen</strong> for at spole <strong>time for time</strong> gennem
            7 døgn frem og 7 tilbage — dagen og klokkeslættet står ovenover, og prikkerne
            skifter tal og farve med. I en flad uge rykker tallene sig kun lidt; det er havet,
            ikke kortet, der står stille.
          </p>
          <p>
            <strong>Tallet i prikken</strong> er spottets score (0–10) på det valgte tidspunkt,
            med samme farver som alle andre steder i appen. <strong>Tryk på en prik</strong> for
            dom, læside og bølgetal.
          </p>
          <p>
            <strong>Pletterne ude i vandet</strong> er områdets bølgemåling: vandfarven viser
            højden (blå = småt, lysere mod hvidt = større), pilene viser hvilken vej bølgerne
            løber, og tallet er højden i meter. Én plet pr. vejr-område — det er dér, tallene
            måles, ikke et kort over hele havet.
          </p>
          <p>
            En <strong>stiplet ring</strong> betyder ukalibreret spot — retningen er et gæt
            endnu. De små hvide streger er høfderne. Kortudsnit, du har set, virker også uden
            net.
          </p>
        </Info>
      </div>
      <div className="map-body">
        <div ref={mapEl} className="map-el" />
        {areaRows.length > 0 && !windOpen && (
          <button className="map-wind-fab" onClick={toggleWind} aria-label="vis vind og bølge">
            <WindArrow deg={areaRows[0].row.wdir} spd={areaRows[0].row.wspd} size={22} />
          </button>
        )}
        {areaRows.length > 0 && windOpen && (
          <div className="map-wind" aria-label="vind og bølgeretning">
            <div className="map-wind-head">
              <span>VIND & BØLGE</span>
              <button onClick={toggleWind} aria-label="fold sammen">
                ✕
              </button>
            </div>
            {areaRows.map(({ label, row }) => {
              const closed = closedAreas.includes(label);
              return (
                <div key={label}>
                  {areaRows.length > 1 && (
                    <button className="map-wind-area" onClick={() => toggleArea(label)}>
                      {closed ? "▸" : "▾"} {label}
                    </button>
                  )}
                  {!closed && (
                    <>
                      <div className="map-wind-row">
                        <WindArrow deg={row.wdir} spd={row.wspd} size={22} />
                        <span>
                          <span className="map-wind-label">VIND</span>
                          {compass(row.wdir)} {fmt(row.wspd, 0)} m/s
                        </span>
                      </div>
                      <div className="map-wind-row">
                        <svg
                          width={22}
                          height={22}
                          viewBox="0 0 16 16"
                          style={{ transform: `rotate(${row.swdir + 180}deg)` }}
                        >
                          <line x1="8" y1="14" x2="8" y2="3.5" stroke="#E7E2D3" strokeWidth="1.6" strokeDasharray="2 1.4" />
                          <path d="M8 1 L4.6 6.4 L8 4.8 L11.4 6.4 Z" fill="#E7E2D3" />
                        </svg>
                        <span>
                          <span className="map-wind-label">BØLGE</span>
                          {compass(row.swdir)} {fmt(row.hs)} m
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
