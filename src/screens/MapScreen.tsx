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
import { fmt } from "../lib/format";

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

  // Kortet oprettes én gang
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, { zoomControl: true, attributionControl: true });
    map.setView([56.681, 8.195], 12);
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
      </div>
      <div ref={mapEl} className="map-el" />
    </div>
  );
}
