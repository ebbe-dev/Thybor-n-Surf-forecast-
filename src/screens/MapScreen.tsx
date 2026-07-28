// KORT: Leaflet over tangen. Markør pr. spot farvet efter score til det
// valgte tidspunkt, høfderne som streger vinkelret på kysten, og en
// tidsskyder øverst der scrubber de 7 døgn.

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, type Spot } from "../config/spots";
import { buildDays, nowLocalIso, type Block } from "../lib/blocks";
import { scoreColor, scoreLabel, BG, FG, MUTED } from "../lib/colors";
import { fmtDayLabel, fmtClock } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { Info } from "../components/Info";
import { WindArrow } from "../components/WindArrow";
import type { Row } from "../model/model";

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

  // Blokke pr. spot + fælles tidslinje
  const perSpot = useMemo(() => {
    if (!forecast) return new Map<string, Map<string, Block>>();
    const m = new Map<string, Map<string, Block>>();
    for (const spot of SPOTS) {
      const bm = new Map<string, Block>();
      for (const day of buildDays(forecast, spot))
        for (const b of day.blocks) if (b) bm.set(b.time, b);
      m.set(spot.id, bm);
    }
    return m;
  }, [forecast]);

  const timeline = useMemo(() => {
    const all = new Set<string>();
    for (const bm of perSpot.values()) for (const t of bm.keys()) all.add(t);
    return [...all].sort();
  }, [perSpot]);

  const [idx, setIdx] = useState(-1); // -1 = ikke sat endnu
  useEffect(() => {
    if (idx === -1 && timeline.length > 0) {
      const now = nowLocalIso();
      const i = timeline.findIndex((t) => t >= now);
      setIdx(i === -1 ? timeline.length - 1 : i);
    }
  }, [timeline, idx]);

  const time = idx >= 0 && idx < timeline.length ? timeline[idx] : null;

  // Vind og bølge er fælles for hele strækket (ét gridpunkt for hver) —
  // én viser på kortet, ikke seks ens pile.
  const rowNow: Row | null = useMemo(() => {
    if (!forecast || !time) return null;
    return forecast.rows.find((r) => r.time === time) ?? null;
  }, [forecast, time]);

  // Kortet oprettes én gang
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
    // Indram alle spots uanset hvor langt de spreder sig ned langs tangen
    map.fitBounds(
      L.latLngBounds(SPOTS.map((s) => [s.lat, s.lon] as [number, number])).pad(0.12)
    );
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
    };
  }, []);

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
            <strong>Træk i skyderen</strong> for at spole gennem de næste 7 døgn — dagen og
            klokkeslættet står ovenover, og prikkerne skifter tal og farve med. I en flad uge
            rykker tallene sig kun lidt; det er havet, ikke kortet, der står stille.
          </p>
          <p>
            <strong>Tallet i prikken</strong> er spottets score (0–10) på det valgte tidspunkt,
            med samme farver som alle andre steder i appen. <strong>Tryk på en prik</strong> for
            dom, læside og bølgetal.
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
        {rowNow && (
          <div className="map-wind" aria-label="vind og bølgeretning">
            <div className="map-wind-row">
              <WindArrow deg={rowNow.wdir} spd={rowNow.wspd} size={22} />
              <span>
                <span className="map-wind-label">VIND</span>
                {compass(rowNow.wdir)} {fmt(rowNow.wspd, 0)} m/s
              </span>
            </div>
            <div className="map-wind-row">
              <svg
                width={22}
                height={22}
                viewBox="0 0 16 16"
                style={{ transform: `rotate(${rowNow.swdir + 180}deg)` }}
              >
                <line x1="8" y1="14" x2="8" y2="3.5" stroke="#E7E2D3" strokeWidth="1.6" strokeDasharray="2 1.4" />
                <path d="M8 1 L4.6 6.4 L8 4.8 L11.4 6.4 Z" fill="#E7E2D3" />
              </svg>
              <span>
                <span className="map-wind-label">BØLGE</span>
                {compass(rowNow.swdir)} {fmt(rowNow.hs)} m
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
