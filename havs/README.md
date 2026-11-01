# HAVS Surf-forecast (demo)

Selvstændig web-app (én HTML-fil, ingen build) til at vise HAVS i Løkken
idéen: en dansk surf-forecast i deres design, der nudger surferen til at
pakke det grej, forholdene kræver, og linker direkte til havsstore.dk.

Mappen er adskilt fra Byg Tangen-appen i resten af repoet og rører ikke
den eksisterende kode.

## Hvad den gør

- 9 spots på vestkysten (Løkken som hjemmespot, Nørlev, Blokhus, Klitmøller,
  Hanstholm, Nr. Vorupør, Agger, Thyborøn, Hvide Sande). Nye spots = én linje
  i `SPOTS` (koordinat + kystretning + et vådt bølgepunkt).
- Score 0–10 pr. time ud fra bølgehøjde, periode og vind mod kystretningen.
  Ugeoversigt, timegraf og rangering af alle spots til det valgte tidspunkt.
- Grej-liste ud fra vandtemperatur, vindafkøling, regn og bølgestørrelse:
  dragt-tykkelse, støvler, handsker, hætte, efter-surf (Dryrobe, hue),
  bræt og SUP. Hvert punkt peger på et produkt hos HAVS med pris og link.
- Nudge-boks: leje/kursus på begynderdage, shop/afhentning på gode dage,
  SUP/saunagus når det er fladt.
- Mobil og desktop (én kolonne under 900 px, to kolonner over).

## Data

- Live: Open-Meteo Marine (bølger, vandtemperatur) + Open-Meteo Forecast
  (vind, luft, nedbør), ét kald pr. endpoint for alle spots. Ingen API-nøgle.
- Fallback: indbygget eksempel-uge (typisk november), der vises når kaldet
  fejler, fx i et sandboxed preview. Appen viser altid, hvilken kilde den kører på.

## Produktfeed

`PRODUCTS` i `index.html` er et simpelt feed. Hvert produkt har en kategori
og et interval, som reglerne matcher på:

| felt    | betydning                                      |
|---------|------------------------------------------------|
| `cat`   | wetsuit, boots, gloves, hood, after, board, misc |
| `water` | vandtemperatur-interval [fra, til) i °C         |
| `feels` | føles-som-interval i °C (efter-surf)            |
| `hs`    | bølgehøjde-interval i m (bræt, tilbehør)        |
| `hooded`, `who`, `old`, `from`, `alt` | hætte, målgruppe, førpris, "fra"-pris, alternativ |

Andre shops kan kobles på med samme felter (fx som JSON fra deres shop),
og `SHOP` kan blive en liste med én post pr. shop.

Priser og links er hentet fra havsstore.dk i november 2026 og er vejledende.

## Hosting

Filen kan lægges som den er på fx `til.havsstore.dk` eller en undermappe
på GitHub Pages. På eget domæne henter den live-data; CSS-tokens øverst i
filen (`:root`) er det eneste, der skal rettes for at matche HAVS' brandfarver
og fonte præcist.
