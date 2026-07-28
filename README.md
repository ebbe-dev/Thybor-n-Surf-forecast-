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

## ⚠ Ubekræftede gridkoordinater

`WAVE_POINT` i `src/config/spots.ts` (56.66, 8.13) er **ikke verificeret**
mod bølgemodellen — udviklingsmiljøets netværk blokerede open-meteo.com.
Rammer punktet land, svarer API'et kun null, og appen viser en fejl med
besked om at rette koordinaten. Verificér i browseren (DevTools → Network
→ marine-api-kaldet) og ret i configen.

## Arkitektur

- `src/model/model.ts` — **alle** scoringskonstanter og -funktioner.
  Kalibreret mod faktiske sessions; justér kun her.
- `src/config/spots.ts` — spots med egen kystnormal + gridpunkter.
- `src/lib/colors.ts` — farveskalaen; samme farve = samme betydning overalt.
- `src/api/openMeteo.ts` — henter/fletter forecast; swell-null → fallback
  til vindsø, markeret pr. række. Manglende timer vises som huller.
