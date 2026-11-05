# HAVS Surf (demo)

Kopi af Byg Tangen-appen (resten af repoet) i HAVS' udtryk, samlet i én
HTML-fil uden build. Formål: vise HAVS i Løkken, hvad et samarbejde om en
dansk surf-forecast kunne se ud som. Mappen rører ikke den eksisterende app.

## Skærme (som forlægget)

Sprog: DA / EN / DE i toppen, huskes i browseren. Kompas, ugedage,
decimaltegn og klokkeslæt følger med.

- **NU**: dommen som swipebare spot-kort (bedste først) med scoren time for
  time, horisont 2 døgn / 7 dage, en bjælke med HAVS' tilbud, rangering af
  alle spots efter bedste dagslys-vindue, ugen for det valgte spot som
  barograf (3-timers blokke, vindpil over hver søjle, lys bund ved ground
  swell) og blok-detalje med swell-skala, bølge, front, periode, retning,
  vind, stød, luft, vand (med våddragt-regel), vandstand og grejet til timen
  fra HAVS' hylder (foldet sammen). Dobbelttryk på et spot, eller knappen
  Kort, åbner kortet på spottet til det tidspunkt. Nederst login til loggen.
- **KORT**: Leaflet med tegnet kystlinje (OSM-data, 250 m), tidsskyder time
  for time gennem 9 døgn med afspilning (1×/2×/4×), vejr-skilt pr. område
  med vind (hel pil), bølger (stiplet pil) og swell-type, prik pr. spot med
  score og navn, og vind- og bølgepile ved spottet fra zoom 10.
- **LOG** (kun når man er logget ind): som forlæggets LOG. Ny session med
  dato, klokkeslæt, spot, delvurderinger (størrelse, form, overflade),
  samlet karakter og note; appen gemmer et snapshot af modellens forhold og
  score for tidspunktet. Liste med ret/slet, CSV til udklipsholderen, og
  afvigelsen karakter minus model. Lokal lagring pr. navn i browseren.

## Model og data

- Scoringsmodellen er `src/model/model.ts` ordret (energi, vindkvalitet,
  fralands-/pålandsregler, stød, refleksion, vandstand, høfde-læ).
- Spots: Løkken, Nørlev, Blokhus, Hanstholm, Klitmøller, Vorupør, Agger,
  Thyborøn, Hvide Sande i fire vejr-områder. Nyt spot = én linje i `SPOTS`.
- Data: Open-Meteo Marine + Forecast, 2 dage tilbage og 7 frem, ét kald pr.
  endpoint for alle områder, cache i localStorage. Kan Open-Meteo ikke nås
  (fx i et sandboxed preview), vises en typisk novemberuge som eksempel, og
  det står øverst. Hostet på eget domæne er tallene live.
- Kystlinjen er klippet ud af `@geo-maps/countries-coastline-250m` (OSM,
  ODbL) og ligger inline, fordi kortfliser ikke kan hentes i en artifact.

## Udtryk

Paletten er HAVS' logo: marineblå bund (#2A3A4A) og hvidt. Ordmærket og
hele logoet (HAVS, makrellen, North Shore Surf Løkken) ligger inline som
PNG. Kondenserede versaler (Oswald) til dom, tal og faner som i logoet,
Poppins til brødtekst som på havsstore.dk. Tokens øverst i `<style>`
(`:root`) styrer farverne. Scoreskalaen er forlæggets fem bånd.

## Hosting

Filen kan lægges som den er på fx `til.havsstore.dk`. Leaflet hentes fra
cdnjs; alt andet er i filen.
