# Byg Tangen

Personlig surf-forecast for Harboøre Tange / Thyborøn. Én bruger, ét
spørgsmål: **hvornår skal jeg køre derud, og til hvilken mole.**

Installerbar PWA (Vite + React + TS). Ingen backend — Open-Meteo direkte
fra klienten; Google Sheets via Apps Script kommer i etape 4 til log og
historik-cache.

## Kør

```
npm install
npm run dev        # udvikling
npm run build      # produktion (tsc + vite + service worker)
npm run preview    # server dist/
```

## Status pr. etape

1. **NU** — dom, 7-døgns barograf, blokdetalje + høfde-planview, offline-cache. ✅
2. **KORT** — Leaflet + tidsskyder. Stub.
3. **HISTORIK** — kalender-heatmap, vindrose, fordeling. Stub. Marine-arkivets
   rækkevidde skal verificeres først.
4. **LOG** — sessions til Google Sheets via Apps Script. Stub.

## Gridkoordinater

`WAVE_POINT` i `src/config/spots.ts` (56.66, 8.13) er verificeret i
produktion 28/07/2026 — cellen er våd og returnerer swell-data. Flyttes
punktet til en tør celle, viser appen en fejl i stedet for tomme tal.

Appen er live på https://ebbe-dev.github.io/Thybor-n-Surf-forecast-/
og udgives automatisk ved hvert push (`.github/workflows/deploy.yml`).

## Arkitektur

- `src/model/model.ts` — **alle** scoringskonstanter og -funktioner.
  Kalibreret mod faktiske sessions; justér kun her.
- `src/config/spots.ts` — spots med egen kystnormal + gridpunkter.
- `src/lib/colors.ts` — farveskalaen; samme farve = samme betydning overalt.
- `src/api/openMeteo.ts` — henter/fletter forecast; swell-null → fallback
  til vindsø, markeret pr. række. Manglende timer vises som huller.
