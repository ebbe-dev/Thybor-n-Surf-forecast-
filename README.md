# Byg Tangen

Personlig surf-forecast for Harboøre Tange / Thyborøn. Én bruger, ét
spørgsmål: **hvornår skal jeg køre derud, og til hvilken mole.**

Installerbar PWA (Vite + React + TS). Ingen backend overhovedet —
Open-Meteo direkte fra klienten, log og caches i localStorage,
CSV/JSON-eksport som backup.

## Kør

```
npm install
npm run dev        # udvikling
npm run build      # produktion (tsc + vite + service worker)
npm run preview    # server dist/
```

## Status pr. etape

1. **NU** — dom, 7-døgns barograf, blokdetalje + høfde-planview, offline-cache. ✅
   Dommen er swipebare spot-kort (bedste først) med scoren time for time frem
   til horisonten; horisonten vælges på kortet (2 døgn / 7 dage, huskes i
   `bygtangen.horizon`) og gælder dom, liste og grafer.
2. **KORT** — Leaflet, fem bekræftede spots, tidsskyder, score-tal på markører. ✅
   Afspil-knappen ved klokkeslættet spoler selv én time frem hvert 2. sekund;
   andet og tredje tryk sætter farten op (2× og 4×), fjerde tryk holder pause.
   **Tjek på kortet** (knappen under ugens chips på NU, alle spots) zoomer ind
   på spottet: prikken og pilespidsen trækkes på plads, og "Bekræft" gemmer
   sted, retning og tidspunkt i localStorage (`bygtangen.pos.*`,
   `bygtangen.normal.*`, `bygtangen.checked.*`). "Ret på kortet" åbner tjekket
   igen, og panelet kan sætte tilbage til appens værdi. Kortet tegner nåle og
   høfder efter det bekræftede sted; scoren regner med den bekræftede retning.
   Høfdens **læ** (vindskyggen bag den, `leeShadowLatLngs`) ligger på kortet
   til det valgte tidspunkt og i tegningen under tallene på NU; læsiden regnes
   geometrisk af spottets retning (`leeSide` i `model.ts`). Prikken står på
   høfdens **spids**; høfden tegnes derfra ind mod land.
3. **HISTORIK** — kalender-heatmap (12 mdr.), vindrose, fordeling, dags-timeline
   med session-markering. Kildens reelle dækning vises i UI'et; huller står tomme. ✅
4. **LOG** — lokal session-log med forecast-snapshot, løbende afvigelses-snit
   (karakter × 2 vs. score) og CSV/JSON-eksport. ✅

Google Sheets-backenden fra den oprindelige plan blev fravalgt efter aftale
(28/07/2026, "bare det nemmeste"): loggen bor i localStorage, og eksporten er
backuppen. CSV'en følger spec'ens kolonner: timestamp, spot, rating, note,
hs, tp, swell_dir, wind_spd, wind_dir, gust, predicted_score.

## Gridkoordinater

`WAVE_POINT` i `src/config/spots.ts` (56.66, 8.13) er verificeret i
produktion 28/07/2026 — cellen er våd og returnerer swell-data. Flyttes
punktet til en tør celle, viser appen en fejl i stedet for tomme tal.

Appen er live på https://ebbe-dev.github.io/Thybor-n-Surf-forecast-/
og udgives automatisk ved hvert push (`.github/workflows/deploy.yml`).

## Design

Mørkt, høj kontrast, store trykflader — læses i sollys på stranden.
Hierarki via flader og runde hjørner, ikke via kanter:

- **Dommen øverst** som helte-kort — ét pr. spot i rangeringens rækkefølge,
  swipebare, med scoren time for time (`ScoreSparkline`: 0 i bunden, 10 i
  toppen på alle kort, fladen i skalaens farver, nætter mørke). Det eneste
  sted en kant bærer bandfarve. Ved bølgetallene står, om det er **ground
  swell** eller **wind swell** (afgjort af perioden, grænsen 8 s —
  `src/lib/swell.ts`); den lyse stribe under grafen og den lyse bund under
  en søjle er timerne og blokkene med ground swell, og under tallene viser
  en skala, hvor perioden ligger i forhold til grænsen.
- **Rangeringen** af alle spots nedenunder. Rækkefølgen er rangeringen,
  scoren står i en pille (`ScorePill`) med tekstfarve efter kontrast, så
  tallet altid kan læses. Et dobbelttryk på et spot, på kortet øverst eller
  i listen, åbner KORT på spottet til det tidspunkt (`lib/double-tap.ts`,
  `MapFocus`).
- **Chips** (`SpotChips`) til spot-valg på NU, HISTORIK og LOG.
- **Én ?-knap pr. skærm** (`ScreenHeader`) folder forklaringerne ud.
- Kortet kører på OpenStreetMaps fliser, gjort mørke med et CSS-filter på
  flise-laget (CARTO's mørke fliser kræver API-nøgle). Spot-navne vises
  fra zoom 12. Vejret står som ét skilt pr. område ud for kysten (navn, vind,
  bølger og ground/wind swell med perioden til skyderens tidspunkt, hængende
  ud mod havet fra måleprikken), og fra zoom 15 som pile ved hvert spot.

## Arkitektur

- `src/model/model.ts` — **alle** scoringskonstanter og -funktioner.
  Reglerne og forskningen bag dem står i `docs/surf-science.md`. Skæve
  bølger aftager som en cosinus, der først når nul ved 140°
  (`OBLIQUE_CUTOFF`): en bølge langs kysten tæller omkring halvt, ikke nul.
  Fralandsvind er kun en gave op til 5 m/s og et fradrag fra 12
  (`offshoreStrength`), en mole kaster store bølger tilbage ved spots med
  `reflective` (`reflectionFactor`), og vandstanden trækker ned over +0,4 m
  og under −0,6 m (`levelFactor`). `caveats` siger, hvilke regler der er
  slået til, og fladen viser dem som advarsler.
- `src/config/spots.ts` — spots med egen kystnormal + gridpunkter.
- `src/lib/colors.ts` — farveskalaen; samme farve = samme betydning overalt.
- `src/lib/swell.ts` — ground swell / wind swell afgøres af perioden (≥ 8 s);
  chip, skala, stribe, lys bund og kortets skilte læser alle herfra.
- `src/api/openMeteo.ts` — henter/fletter forecast. Rækken bærer den
  SAMLEDE sø (højde, retning), med dønning og vindsø som dele og vandstanden
  over middel; perioden er den dominerende dels topperiode. Vindsø og
  vandstand hentes i et ekstra kald, der må fejle. Manglende timer vises

- **Målt nu** (`src/api/obs.ts`, `src/lib/obs.ts`, `MeasuredNow`): Kystdirektoratets
  bølgemåler ved Fjaltring (ident 2035, hver halve time: højde, middelperiode,
  retning, største bølge) og DMI's vandstand ved Thyborøn Kyst (hvert 10. minut)
  vises ved siden af forecasten — på NU, som "målt" under tallene i detaljen og i
  kortets stribe for passerede tidspunkter — og modellen holdes op mod bøjen
  over de sidste 48 t (kun højden; bøjens periode er middelperioden). Kilderne
  sender ingen CORS-hoveder, så `.github/workflows/obs.yml` henter dem hver
  halve time og lægger `obs.json` på grenen `data`, som appen læser fra
  raw.githubusercontent.com. Fail-open med cache (`bygtangen.obs1`); rører
  aldrig scoren. Detaljer i `docs/surf-science.md` §10.  som huller.
