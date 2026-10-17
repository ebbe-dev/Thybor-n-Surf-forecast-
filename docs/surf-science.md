# Surf-videnbasen: hvad der styrer surfen på tangen, og hvordan appen regner

Skrevet 13/10/2026. Loggen kan ikke bære kalibreringen (der surfes for
sjældent), så appens regler skal komme fra forskningen og det lokale. Denne
fil samler det, vi ved, med kilder, og siger for hver regel, hvad appen gør
med den. Ret reglen i `src/model/model.ts` og denne fil samtidig.

Tre observationer, der har formet reglerne:

- **26/7/2026, Sneglehuset:** 1,3 m / 6,7 s NV ret på kysten, vind V 2,6 m/s.
  En 10'er. Modellens energiloft er sat efter den dag.
- **11/10/2026:** fralandsvind, læ, høje bølger. Appen sagde over 7. Bølgerne
  knækkede for langt inde, eller de blev spist af den bølge, der ville ud igen
  efter at have ramt molen. (Afsnit 5 og 7.)
- **13/10/2026:** sydbølge langs Harboøre Tange (DMI: 1,5 m fra S, vind SSV
  10 m/s). Appen gav 0 ved alle NV-vendte Thyborøn-spots, mens en erfaren surfer
  pegede på stykket Langerhuse–Terrassen og sagde: man vælger størrelsen ved at
  gå nord eller syd. (Afsnit 2 og 3.) Kl. 12–14 var det "helt fantastisk" ved
  Langerhuse H; appen stod under 5, fordi sydvinden talte som ren sidevind,
  selvom teksten skrev "læ på nordsiden" (afsnit 5, høfdens læ).

## 1. Peel-vinklen: den skrå bølge, der peeler

Walker (1974) definerede **peel-vinklen** som vinklen mellem bølgekammen og
brydningslinjen. 0° er en closeout, hvor hele kammen bryder på én gang. Jo
mindre vinkel, jo hurtigere løber brydningen langs kammen: brydningspunktet
løber med c/tan α og surferen skal holde c/sin α, hvor c er bølgens hastighed.
Walker satte gulvet ved omkring 30° og målte topfarter på omkring 12 m/s fra
luftfotos. Hutt, Black og Mead (2001) gjorde det til en skala fra 1 til 10,
hvor hvert trin har en peel-vinkel og et bølgehøjde-interval. Læsningen på
tværs af kilderne:

| Peel-vinkel | Hvad det er |
|---|---|
| under ca. 25° | closeout |
| 30–45° | hurtig, for øvede |
| 45–66° | det meste surf |
| 60–90° | langsom, begyndere |

Større bølger kræver større vinkel, fordi bølgen går hurtigere. Scarfe m.fl.
kalder peel-vinklen den vigtigste parameter efter højden, og deres pointe
bærer resten af filen: **et surfspots opgave er at hæve peel-vinklen op i det
surfbare område**, for lave vinkler bryder for hurtigt.

Appen kan ikke regne peel-vinklen: den afhænger af bunden (afsnit 2 og 9).
Loggens felt *Form* (0 = closeouts, 10 = perfekt væg) er netop den.

## 2. Refraktion: retningen ude på havet giver ikke vinklen på stranden

Bølger drejer ind mod stranden på det lave vand (Snells lov). Lineær
bølgeteori for en 1,5 m bølge, der bryder på en lige kyst (H = 0,78·dybde):

| Vinkel ude | Brydningsvinkel, 5,5 s | Højde ved brydning | Brydningsvinkel, 9 s |
|---|---|---|---|
| 0° | 0° | 100 % | 0° |
| 30° | 14° | 95 % | 10° |
| 45° | 19° | 89 % | 13° |
| 60° | 22° | 77 % | 15° |
| 80° | 21° | 50 % | 15° |
| 85° | 18° | 37 % | 14° |

To konsekvenser:

- **Vinklen:** uanset hvor skråt bølgen kommer, rammer den brydningslinjen
  under 22°. En lige strand med lige revler er en closeout ved enhver retning,
  og den lange dønning drejer mere ind end vindsøen. Det, der får bølgen til
  at peele, er bunden: revlerne mellem høfderne og høfdehovedet, som bølgen
  bøjer rundt om (afsnit 9).
- **Størrelsen:** energien fordeles over mere kyst, jo skråere bølgen kommer.
  Det er "mindre" i surferens læsning 13/10. Ved 85° er godt en tredjedel af
  højden tilbage på den åbne strand, og mere dér, hvor en høfde fanger bølgen.

**Hvornår er skrå optimalt?** For en høfdekyst: 30–60° ude på havet. Bølgen
beholder 77–89 % af højden, og høfderne har noget at fange og bøje. Lige på er
størst, men så bærer revlerne alene peelet. Langs kysten er det halv størrelse
eller mindre, høfderne fanger den, og man vælger størrelsen ved at gå nord
eller syd.

## 3. Retningsspredning og appens vinkelregel

En sø er spredt over retninger. Goda og Suzuki: spredningsparameter s = 10 for
vindsø, 25 for dønning med kort løb, 75 for dønning med langt løb. Energiens
andel pr. meter kyst (kun komponenter mod kysten tæller):

| Vinkel ude | Ren cosinus (til 13/10) | Fysik, vindsø s=10 | Fysik, lang dønning s=75 | Appen nu, 140° |
|---|---|---|---|---|
| 45° | 0,71 | 0,65 | 0,70 | 0,88 |
| 60° | 0,50 | 0,48 | 0,49 | 0,78 |
| 80° | 0,17 | 0,25 | 0,18 | 0,62 |
| 90° | 0,00 | 0,16 | 0,06 | 0,53 |
| 110° | 0,00 | 0,05 | 0,00 | 0,33 |

**Appens regel** (`OBLIQUE_CUTOFF = 140`, `obliqueFactor`): energien aftager
som en cosinus strakt til 140°. Den er to til tre gange så gavmild som
fysikken ved 80–90°. Afstanden er høfdernes bidrag: en høfde på 130–150 m, der
stikker ud i 2–3 m vand, fanger en bølge langs kysten på sin opvinds-side og
bøjer den rundt om hovedet (diffraktion: omkring halv højde langs
skyggelinjen). Reglen er ikke efterprøvet; en rigtigere model kræver bunden
(afsnit 12).

## 4. Vindsø og dønning

**Dønning** er bølger, der ikke længere drives af den lokale vind (rejst af et
blæsevejr langt væk); **vindsø** er bølger, vinden rejser her og nu. Surfere
skelner på perioden: ground swell er lang, wind swell kort. Appen sætter
grænsen ved 8 s (`GROUND_SWELL_MIN_TP`), fordi Nordsøen er et lille hav, hvor
Atlanterhavets 10–12 s næsten aldrig kommer.

**Hvilken periode:** en blandet søs *middel*periode trækkes ned af vindsøen.
Surfere læser *top*perioden (den dominerende komponent). Appen bruger derfor
den dominerende dels topperiode, når den del bærer mindst halvdelen af
energien (højde²), ellers den samlede middelperiode (`dominantPeriod`).

**Hvilken højde:** til 13/10 bar rækken dønningen alene, når Open-Meteo kunne
skille den ud. På en dag med vindsø fra syd stod appen så med en lille
NV-dønning, mens surferne stod i 1,5 m sydbølge. Rækken bærer nu den SAMLEDE
sø (`wave_height`, `wave_direction`), og delene står ved siden af. På rene
dage er samlet ≈ dønning, så ankeret fra 26/7 holder.

## 5. Vind: fraland er kun en gave op til et punkt

- Fralandsvind holder bølgen oppe og gør den stejl og hul. Idealet er under
  omkring 10 knob (5 m/s); fra 15–20 knob (8–10 m/s) bliver det en kamp at
  padle ind, dråberne stejle, sprøjt i øjnene.
- Douglass (1990), bølgerende: **fralandsvind får bølgerne til at bryde senere,
  på lavere vand, tættere på stranden, og som plunging; pålandsvind får dem til
  at bryde tidligere, på dybere vand, længere ude, og som spilling.** Vinden
  flytter mest brydningsdybden, ikke brydningshøjden.
- Jo større søen er, jo mindre betyder vinden for bølgens form.
- Pålandsvind over 10 knob ødelægger en session.

Det er 11/10 i ét afsnit: hård fralandsvind, høje bølger, og bølgerne
"knækkede for langt inde".

**Pålandsvind.** Lidt påland dæmper kun: scoren har et gulv på 0,35 af
energien. Men over 6 m/s lige på land er søen blæst ud og rodet, og høfden
giver intet læ (vinden står langs den). Appen (`onshoreBlowout`): fradrag fra
6 m/s, fuldt (0,7) fra 14 m/s, ganget med pålands-andelen i anden, så
sidevind går fri. Vestenvind 12 m/s ved Q med 2 m: 3,5 før, 1,7 nu. (14/10:
"det blæser en halv pelikan fra vest, det bliver blæst ud og rodet".)

**Høfdens læ.** Står vinden på tværs af høfden, er vandet glat på læsiden,
og man går derhen. Læet er kun så godt, som vinden står på tværs: vind langs
høfden (lige på land eller lige fra land) giver intet. Appen
(`groyneShelter`): vindkvaliteten løftes til mindst 0,75 · sin(vinklen
mellem vind og spottets retning), op til 12 m/s, for alle spots med høfder;
enkeltsidede spots (Q, Thorsminde) får det kun, når læet ligger på den side,
der surfes, og halveres ellers. Vind lige på land giver stadig 0: der er
ingen læ at gå i, og søen er rodet.

**Appens regel** (`offshoreStrength`): fralandsvind over 5 m/s
(`OFFSHORE_IDEAL_MAX`) trækker vindkvaliteten ned, fuldt fradrag på 0,6
(`OFFSHORE_STRONG_PENALTY`) fra 12 m/s (`OFFSHORE_TOO_STRONG`), ganget med
vindens fralands-andel (cos til fralandsretningen, kvadreret, så en
side-fralandsvind rammes blødt). Ren fralandsvind: 5 m/s → 1,00, 8,5 m/s →
0,70, 12+ m/s → 0,40. Sidevind og pålandsvind er uændret.
Advarslen "hård fralandsvind" står fra en styrke på 0,3 (ren fralandsvind over
7 m/s).

## 6. Vandstand og tidevand

- Dybden over revlen styrer brydningen; en bølge bryder omkring hvor dybden er
  1,3 gange højden. Revler bryder bedst ved lav til middel vandstand; ved høj
  vandstand ruller bølgerne over revlen, mister formen og knækker inde ved
  stranden. Stejle spots kan blive closeouts ved lav vandstand.
- **Thyborøn:** tidevandet er lille. DMI: langs vestkysten kommer det 1–2 timer
  senere end i Vadehavet, og højvandet er 0,4–0,6 m; ca. 6 t 12 min mellem
  høj- og lavvande. Vandstanden domineres af vinden og lavtrykkene: vestenvind
  stuver vandet op (DMI varsler ved 1,9 m ved Thyborøn, over 2 m er set), og
  østenvind trykker det ned. (Østenvindens virkning på vestkysten er fysik og
  erfaring; DMI's artikler om østenvind handler om Østersøen.)
- Thyborøn Havn viser vind og vandstand live:
  https://www.thyboronport.dk/vejr-and-vandstand.html

**Datakilde:** Open-Meteos `sea_level_height_msl` (tidevand, lufttrykkets
virkning, havmodellens overfladehøjde; nulpunkt middelvandstand; "ikke til
navigation"). Det er ikke en kystnær stormflodsmodel, så en hård vestenstorm
undervurderes.

**Appens regel** (`levelFactor`): over +0,4 m (`LEVEL_HIGH_FROM`) trækkes ned
til 0,6 ved +1,0 m; under −0,6 m trækkes ned til 0,85 ved −1,2 m. Uden
vandstand regnes intet. Vandstanden står i tallene og på striben under kortets
skyder.

## 7. Refleksion ved moler

- Refleksionskoefficienten er forholdet mellem tilbagekastet og indkommende
  bølgehøjde. Lodrette mure: tæt på 1. Stenkastningsmoler: under ca. 0,6.
  Stejle bølger reflekteres mindre; lange, flade bølger mere.
- The Wedge (Newport Beach) er mekanismen i ren form: en mole kaster sydbølgen
  diagonalt tilbage, den møder den næste bølge i fase og bygger en stejl,
  dobbelt så høj top, der lukker på sandet, og tilbageskyllet kolliderer med
  de indkommende bølger.
- 11/10: "spist af den bølge, der ville ud igen efter at have ramt molen".

**Appens regel** (`reflectionFactor`, kun spots med `reflective`:
Indsejlingen, Færgehavnen, Thorsminde): fra 1,0 m (`REFLECTION_FROM_HS`)
trækkes ned til 0,5 ved 2,0 m (`REFLECTION_FULL_HS`). Advarslen "molen
kaster bølgerne tilbage" står, når fradraget er over 10 %.

## 8. Brydningstype og stejlhed

Iribarren-tallet (strandhældning / kvadratroden af bølgens stejlhed) siger,
hvordan bølgen bryder: dybtvandsværdi under 0,5 spilling, 0,5–3,3 plunging,
over 3,3 collapsing/surging (ved brydningspunktet 0,4 og 2,0). Flade,
dissipative strande som vestkysten og stejl vindsø giver spilling; lang
dønning og stejlere bund giver plunging. Tallet er kun en størrelsesorden i
overgangene. **Ikke i modellen endnu:** det kræver revlens hældning pr. spot
(afsnit 12).

## 9. Lokalt: Harboøre Tange og Thyborøn

- **Tangen:** en 10 km lang sandtange mellem Nissum Bredning og Vesterhavet,
  skåret igennem af Thyborøn Kanal. 30 store høfder af sten og betonblokke
  beskytter den (bygget fra 1885); staten (Kystdirektoratet) ejer tangen og
  har holdt kanalen åben siden 1862. Kystdirektoratet sandfodrer revlen,
  senest 441.000 m³ mellem høfde 47 og 53.
- **Revler:** på flade kyster som Vesterhavet ofte tre, tit kun to, nogle
  steder ingen. Yderrevlen er stabil (kun de største bølger rører den), de
  indre flytter sig. Det aktive profil rækker ud til 3–5 m dybde. Afstanden
  mellem revlerne følger strandplanets hældning.
- **Harboøre-spottet** (Visit Nordvestkysten): beach break i et høfdefelt,
  højrebølger, mest fra NV; bedst med NV-dønning og vind fra NØ–Ø–SØ; holder
  op til dobbelt mandshøjde; sandbankerne flytter sig med bølger og vind, så
  det kan tage en dag at finde den rigtige; øvede og opefter.
- **Høfde Q:** klassisk højrebølge, lang og hul på gode dage; surfes syd for
  høfden; de sidste 3–4 høfder mod syd er bedst; øvet/ekspert. Visit Agger
  (efterset 14/10): "fungerer som et lille point break. Man går i vandet på
  indersiden af den sydvendte mole og padler lige ud i takeoff-zonen",
  kræver vind fra N–NNØ (det lægger læet på sydsiden), og man skal ikke
  drive ind foran molen i et stort sæt. Høfde Q blev anlagt 1934
  (Kystdirektoratet). Geometrien: en højrebølge på en vestkyst rides mod
  syd, og V/NV-swell bøjer rundt om høfdehovedet og peeler langs sydsiden;
  nordsiden ville kun give en venstre ved SV-swell.
- **Thorsminde:** højrebølge langs den store mole, surfes mod syd.
- **Gradienten 13/10** (erfaren surfer): ved sydbølge langs tangen er man
  mest udsat sydpå (Q: større, mere rodet); nordpå skygger Thyborøns mole, så
  bølgerne er mindre, men perioden bedre og bølgen renere, og risikoen er, at
  det bliver for småt. Vælg et spot imellem efter revlerne. Det er fysik:
  molen tager den korte sø, og de lange bølger bøjer rundt om den.
- **Molerne:** Thyborøn Kanals moler og Thorsmindes mole er lange og
  reflekterer (afsnit 7). Ved høfder med sidevind opstår en hestehuls-strøm
  langs høfden og en rip ud langs den (kyststudie af høfdelæ).
- **Sæson:** september til marts har mest energi i Nordsøen; fralandsvind er
  almindeligere om efteråret og vinteren.

## 10. Datakilder

**Forecast (det, scoren regnes af):**

- **Open-Meteo marine** (gratis, uden nøgle): `wave_height/direction/period`
  (samlet), `swell_wave_*` og `wind_wave_*` med `*_peak_period`,
  `sea_level_height_msl`, og fra 17/10/2026 `secondary_swell_wave_*` (kun
  middelperiode) og `sea_surface_temperature`. Appen henter kernen i ét
  kald, vindsø + vandstand + 2. dønning + vandtemperatur i et ekstra kald,
  der må fejle, og højden fra fem modeller i et tredje (§14), der også må
  fejle. To bølgepunkter: ud for Thyborøn (56,66 N 8,13 Ø) og ud for
  Bovbjerg/Thorsminde (56,45 N 8,00 Ø). Flere modelpunkter giver ikke mere:
  det er samme model, samme fejl.
  **Proben 17/10/2026** (`scripts/probe-openmeteo.mjs`, kørt fra GitHub
  Actions med `openmeteo=true`, fordi containeren ikke når tjenesten):
  `best_match` er for højden Météo-Frances MFWAM (tallene er identiske
  time for time), ikke DWD's, som dokumentationen fik det til at lyde;
  `wave_peak_period` og `tertiary_swell_wave_*` er tomme her;
  `secondary_swell_wave_peak_period` findes ikke; vandtemperatur og strøm
  kommer fra Météo-Frances havmodel; ECMWF's 0,25°-model har tør celle ved
  Thyborøn-punktet.
- **DMI:** kort over bølgehøjde og vind (det, surferen læste 13/10), tidevands-
  tabeller, varsler om forhøjet vandstand.

**Målt (det, havet faktisk gør — rører aldrig scoren):**

- **Kystdirektoratets bølgemåler ved Fjaltring**, ident **2035** (aktiv siden
  18/8-2023; 2031 var den gamle på samme sted 1991-2023), ETRS89/UTM32
  441896/6259258 ≈ 56,49 N 8,10 Ø, 17,5 m vand — ud for Høfde Q, nærmest
  det sydlige bølgepunkt. Hver halve time: `H_M0` (signifikant højde),
  `T_z` (middelperiode), `H_max`, `T_max`, `Dir` (spektrets top). `T_s` står
  som 0 (pladsholder). Webtjeneste:
  `https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=2035&startdate=ÅÅÅÅMMDD&enddate=ÅÅÅÅMMDD&format=csv`
  — datoerne SKAL være ÅÅÅÅMMDD, og `enddate` er eksklusiv ud over kl.
  00:00, så dagen i dag kræver `enddate` i morgen. Fundet 16/10/2026 ved at
  prøve ident 2000-2199: tjenestens egne sider (graf, kort, metadata) ligger
  bag JavaScript, og kyst.dk's kort er en Next.js-side uden idents i HTML'en.
  `Datotid` er UTC (§12, punkt 6).
- **DMI's åbne vandstands-API** (ingen nøgle): `opendataapi.dmi.dk/v2/oceanObs`,
  station **9004203 Thyborøn Kyst**, parameter `sea_reg` (Kystdirektoratets
  egne målere; `sealev_dvr`/`sealev_ln` svarer tomt), cm over middel hvert
  10. minut. Thyborøn Havn (9004201) stoppede i april 2026.
- **Vejen ind i appen:** hverken kyst.dk eller DMI sender CORS-hoveder, så
  browseren kan ikke hente dem selv. GitHub Actions
  (`.github/workflows/obs.yml`, `scripts/fetch-obs.mjs`) henter begge hver
  halve time og lægger `obs.json` (sidste 48 t) på grenen `data`;
  `raw.githubusercontent.com` tillader kald fra appen (op til 5 min cache).
  Appen viser dem som **Målt nu** på NU, som "målt" under tallene i detaljen
  og i kortets stribe for tidspunkter, der er passeret — og holder modellen op
  mod bøjen over de sidste to døgn (`src/lib/obs.ts`).

**Periode mod periode.** Bøjen giver middelperioden T_z (zero-crossing /
spektral m0/m2), appen bruger topperioden T_p. For et JONSWAP-spektrum er
T_p ≈ 1,2–1,3 · T_z; for en blandet sø er forholdet større. Derfor står der
"middel" ved bøjens periode, den får aldrig ground swell-mærket, og modellen
mod bøjen sammenligner KUN højden (begge er signifikant bølgehøjde). En 6,5 s
middelperiode ved bøjen svarer til omkring 8 s i top — grænsen for ground
swell i appen.

**Thyborøn Havn:** vind og vandstand live (web, ikke API) — ikke koblet på.

## 11. Reglerne i appen, samlet

| Regel | Konstanter | Hvor |
|---|---|---|
| Energi = 15·H²·T·vinkelfaktor, loft 170 | `ENERGY_NORM`, `OBLIQUE_CUTOFF = 140` | `energy`, `obliqueFactor` |
| Vindkvalitet: fraland 1, sidevind 0,5, påland 0; glas under 6 m/s; N-bonus | `GLASS_WIND` | `windQuality` |
| Hård fralandsvind: fradrag fra 5 m/s, fuldt (0,6) fra 12 | `OFFSHORE_IDEAL_MAX/TOO_STRONG/STRONG_PENALTY` | `offshoreStrength` |
| Hård pålandsvind: fradrag fra 6 m/s lige på land, fuldt (0,7) fra 14 | `ONSHORE_BLOWOUT_*` | `onshoreBlowout` |
| Høfdens læ: tværvind løfter til 0,75·sin(vinkel), op til 12 m/s; enkeltsidede spots kun på deres side, forkert side halverer | `SIDE_SHELTER_MIN`, `SIDE_MISMATCH`, `groyneShelter` | `scoreSpot` |
| Mole: fradrag fra 1,0 m, 0,5 ved 2,0 m | `REFLECTION_*` | `reflectionFactor` |
| Vandstand: ned til 0,6 over +0,4…+1,0 m; ned til 0,85 under −0,6…−1,2 m | `LEVEL_*` | `levelFactor` |
| Størrelsesgate under 0,5 m; stød over 14 m/s koster 15 % | `SIZE_GATE_M`, `GUST_LIMIT` | `scoreSpot` |
| Ground swell fra 8 s (den dominerende dels topperiode) | `GROUND_SWELL_MIN_TP` | `lib/swell.ts` |

Score = 10 · energi^0,6 · (0,35 + 0,65 · vind) · gate · stød · mole · vandstand · påland.

Vist, men uden for scoren: bølgens front (§13), modellernes spænd med ±
og "usikker" (§14), ground swell under vindsøen, 2. dønning og
vandtemperaturen med våddragt (§15), og målingerne (§10).

## 12. Åbne spørgsmål

1. **Bunden.** Peel-vinkel og brydningstype kræver revlens hældning og
   høfdernes geometri pr. spot. Kystdirektoratets profilmålinger findes, men
   er ikke hentet.
2. **Høfdernes fang.** 140°-reglen er et gæt mellem fysik og erfaring. En
   model med diffraktion om høfdehovedet (ca. halv højde langs skyggelinjen)
   og høfdens længde kunne erstatte den.
3. **Vandstand.** Open-Meteos vandstand er ikke en stormflodsmodel. DMI's
   vandstandsvarsel eller havnens måler ville være bedre ved vestenstorm.
4. **Thyborøn-spottenes swell-vindue.** "Mindre men renere nordpå" ved
   sydbølge er ikke i modellen: alle Thyborøn-spots deler ét bølgepunkt.
5. **Efterprøvning.** Hver session, der logges (spot, karakter, *Form*),
   er stadig den eneste måde at se, om reglerne rammer.
6. **Bøjens tidsstempler — afgjort 16/10/2026: UTC.** `Datotid` i
   Kystdirektoratets fil står uden zone. `probe=true` i workflowet holder
   bøjens højde op mod Open-Meteo for bøjens punkt, forskudt −6..+6 timer.
   Læst som dansk tid passede modellen bedst forskudt +2..+3 t (spredning
   0,143 m ved 0, 0,099 m ved +2, 0,093 m ved +3), og den nyeste række var
   131 min gammel. Læst som UTC ligger minimum ved 0 (spredning 0,107 m ved
   0, 0,110 ved +1, 0,140 ved −2), og den nyeste række er 10-20 min gammel.
   Stemplerne er UTC (`KDI_TZ=UTC`). Prøven ligger i loggen, hvis tjenesten
   skifter. Samme prøve viste modellen ~0,1 m under bøjen de to døgn.
7. **Vindmodellen — afgjort 17/10/2026: best_match er IKKE DMI.** Proben
   holdt vind-API'ets `best_match` op mod `dmi_seamless` for 56,68 N 8,20 Ø
   over 48 t: ingen ens timer, snit 1,0 m/s forskel; tættest på
   `icon_seamless` (0,6 m/s), længst fra ECMWF (2,3 m/s). DMI's HARMONIE
   (2 km, 2,5 døgn, 3-timers opdatering) kan hentes med
   `models=dmi_seamless`, men om den rammer bedre ved kysten, kan kun målt
   vind afgøre (Thyborøn Havn viser den, uden API). Ikke skiftet.
8. **Fronten pr. spot.** §13 regner fronten for en åben strand. Refraktion
   fra 17,5 m (Snell, §2) og høfdernes fang ville give den pr. spot.

## 13. Bølgens front: det tal, man ser fra stranden

Hs er havets tal (det, bøjen måler på 17,5 m og modellen regner i). Surferen
læser bølgens front, når den rejser sig og bryder på revlen. Komar & Gaughan
(1972) gav den af dybvandshøjden H0 og perioden T med lineær teori og
breaker-indeks 0,78:

    Hb = 0,39 · g^(1/5) · (T · H0²)^(2/5)

Perioden laver bølgen: den lange dønning rejser sig højere, end den var ude
på havet.

| Hs ude | 5 s | 6 s | 8 s | 10 s | 12 s |
|---|---|---|---|---|---|
| 0,5 m | 0,67 m | 0,72 m | 0,81 m | 0,88 m | 0,95 m |
| 1,0 m | 1,17 m | 1,26 m | 1,41 m | 1,54 m | 1,65 m |
| 1,5 m | 1,61 m | 1,74 m | 1,95 m | 2,14 m | 2,29 m |
| 2,0 m | 2,04 m | 2,20 m | 2,47 m | 2,70 m | 2,90 m |

Forbehold: formlen gælder en åben, jævn strand uden refraktion og
bundfriktion (begge trækker ned på skrå dage, §2), og den giver den
*signifikante* brydningshøjde; sættene er større, de største bølger omkring
1,3 gange. Fronten er altså det typiske, ikke det største.

**Appen** (`lib/surfHeight.ts`, 17/10/2026): fronten står som et tal ved
siden af Hs — "front 1,9 m" på dommen, FRONT i detaljen, i kortets pop-up
og stribe — regnet af rækkens samlede højde og dominerende topperiode.
Under en meter i hele 5 cm ("85 cm"). Kontakten "Vis bølgens front i
meter" står under Indstillinger nederst på NU (`bygtangen.surfheight`,
standard til). Ebbe 17/10: hellere meter og centimeter end ord. Scoren
bruger stadig hs²·tp og rører ikke fronten.

## 14. Modelspredning: hvor meget skal man tro på tallet

En forecast uden usikkerhed er præcis på papiret og forkert i vandet. Det
ærligste mål er, hvor uenige bølgemodellerne er, især dag 3-7. Open-Meteo
giver flere modeller i ét kald med `models=`; proben 17/10/2026 fandt for
appens to punkter:

| Model | Hvad | Rækkevidde | Bemærkning |
|---|---|---|---|
| `best_match` | = Météo-Frances MFWAM her | 7 døgn | appens tal (scoren) |
| `ewam` | DWD's europæiske, 5 km | 3,3 døgn | højest opløst |
| `gwam` | DWD's globale, 28 km | 7 døgn | |
| `ecmwf_wam025` | ECMWF, 0,25° | 7 døgn | tør celle ved Thyborøn-punktet, kun sydpunktet |
| `ncep_gfswave025` | NOAA, 0,25° | 7 døgn | lå lavest 17/10 |
| `meteofrance_wave` | MFWAM | 7 døgn | identisk med best_match, hentes ikke dobbelt |
| `ncep_gefswave025`, `era5_ocean`, `meteofrance_currents` | | | ingen bølgetal her |

Eksempel 17/10 kl. 00 UTC, Thyborøn-punktet: ewam 1,98, gwam 1,84, MFWAM
1,62, NOAA 1,28 m — et spænd på 0,7 m på dag 0. Dag 3: 0,44-0,58 m, enige.

**Appen** (`api/openMeteo.ts`, `lib/spread.ts`): ét ekstra kald henter
`wave_height` for de fem modeller (nøgler `wave_height_<model>`,
`wave_height_marine_best_match`); pr. time bærer rækken laveste og højeste
højde og antallet af modeller med tal (`hsSpread`); appens eget tal hører
med i spændet. Er spændet over 0,3 m (`SPREAD_UNSURE_M`), står højden med
± overalt ("1,5 ±0,4 m" er 1,1-1,9 m), detaljen giver frontens spænd, og
dommen tones ned med linjen "usikker · 4 modeller siger 1,1-1,9 m" —
dæmpet, uden advarselstegn: det er tvivl, ikke fradrag. Er de enige, står
tallet alene. Scoren regner stadig på best_match alene.

## 15. Søens dele, ground swell under vindsøen, vandet

**2. dønning.** MFWAM skiller en sekundær dønning ud (højde, middelperiode,
retning; ingen topperiode). Den står under skalaen i detaljen fra 0,2 m:
"dønning 1,1 m / 6,0 s S · 2. dønning 0,5 m / 9,0 s VNV · vindsø 0,7 m /
4,5 s SSV".

**Ground swell under.** Rækkens periode er den dominerende dels (§4), så en
lang dønning på et par decimeter under en større vindsø får mærket wind
swell, selvom der er orden i søen. Ligger der en dønnings-del (den primære
med sin topperiode eller den sekundære med sin middelperiode) med 8 s og
op og mindst 0,3 m (`UNDER_MIN_HS`), står mærket GROUND SWELL UNDER ved
siden af wind swell på dommen og i detaljen, med delen i tal. Kun når
rækken selv siger wind swell. Scoren er uændret: den regner på den
samlede sø og den dominerende periode.

**Vandet.** `sea_surface_temperature` er overfladetemperaturen ude ved
bølgepunktet fra Météo-Frances havmodel (ikke en måling). Den står som
"vand 13 °C" på dommen og i kortets stribe og som VAND i detaljen med en
tommelfingerregel for våddragten (`lib/water.ts`, ret grænserne, når
kroppen siger noget andet):

| Vand | Dragt |
|---|---|
| 20 °C og op | 3/2 eller shorty |
| 17-20 °C | 3/2 |
| 14-17 °C | 3/2 eller 4/3 |
| 11-14 °C | 4/3 + støvler |
| 8-11 °C | 5/4 + hætte, støvler og handsker |
| under 8 °C | 6/5 + hætte, støvler og handsker |

## Kilder

- Komar, P.D. & Gaughan, M.K. (1972), Airy Wave Theory and Breaker Height
  Prediction, Proc. 13th Int. Conf. Coastal Engineering:
  https://icce-ojs-tamu.tdl.org/icce/article/view/2699
- Open-Meteo, modeller og opdateringer: https://open-meteo.com/en/docs/model-updates
  og https://openmeteo.substack.com/p/marine-weather-forecast-api
- Open-Meteo DMI-modellen: https://open-meteo.com/en/docs/dmi-api

- Hutt, Black & Mead (2001), Classification of Surf Breaks in Relation to
  Surfing Skill, J. Coastal Research SI 29:
  https://www.researchgate.net/publication/277019083
- Scarfe, Healy & Rennie (2009), Research-Based Surfing Literature for
  Coastal Management and the Science of Surfing, J. Coastal Research 25(3):
  https://bioone.org/journals/journal-of-coastal-research/volume-2009/issue-253/07-0958.1/
- Scripps-rapport om surfparametre (Walkers peel-vinkel og farter):
  https://escholarship.org/content/qt6h72j1fz/qt6h72j1fz.pdf
- Okun, Why is peel angle important for surfing:
  https://www.scienceofsurfing.com/p/peel-angle
- Dally, Stochastic Modeling of Surfing Climate (ICCE):
  https://icce-ojs-tamu.tdl.org/icce/index.php/icce/article/download/4469/4150/
- Douglass (1990), Influence of Wind on Breaking Waves:
  https://www.semanticscholar.org/paper/5e4eaf4cf3681a474345d8ffd45f1b9ce36ae027
- Feddersen & Veron (2005), Wind Effects on Shoaling Wave Shape, JPO 35(7):
  https://journals.ametsoc.org/view/journals/phoc/35/7/jpo2753.1.xml
- Iribarren-tallet: https://en.wikipedia.org/wiki/Iribarren_number
- Reflektionskoefficienter (stenkastning, lodrette mure):
  https://doi.org/10.3390/jmse9090937 og
  https://www.researchgate.net/publication/268313891
- The Wedge: https://en.wikipedia.org/wiki/The_Wedge_(surfing)
- Hestehuller og strøm i læ af høfder:
  https://www.sciencedirect.com/science/article/abs/pii/S0278434309001514
- Retningsspredning (Goda-Suzuki s-værdier):
  https://jomase.ejournal.unri.ac.id/index.php/JOMASE/article/download/4199/4051
- Vind for surfere (knob-grænser): https://neptune.coach/blog/how-wind-affects-surfing
  og https://www.watersportgeek.com/surfing-when-windy/
- Tidevand og revler: https://en.wikipedia.org/wiki/Surf_forecasting og
  https://www.seabreeze.com.au/Articles/Surfing/Reading-a-Beach-Break-Banks-Peaks-Channels
- DMI, stormfloden 3/12/1999 (tidevand på vestkysten):
  https://ocean.dmi.dk/staff/mhri/Docs/Vejret82_2000.pdf
- DMI, Følg en forhøjet vandstand:
  https://www.dmi.dk/nyheder/2020/foelg-en-forhoejet-vandstand-med-dmi
- Tidevandstabel for Thyborøn:
  https://www.thyboron-turist.dk/tidevandstabel-for-thyboroen/
- Thyborøn Havn, vejr og vandstand:
  https://www.thyboronport.dk/vejr-and-vandstand.html
- Harboøre Tange (Lex): https://lex.dk/Harbo%C3%B8re_Tange og
  https://da.wikipedia.org/wiki/Harbo%C3%B8re_Tange
- Kystdirektoratet, sandfodring på Vestkysten:
  https://kyst.dk/klimatilpasning/sandfodring-paa-vestkysten
- Revler (Lex, Livredning.dk): https://lex.dk/kyst og http://livredning.dk/revler.html
- Surfspot Harboøre (Visit Nordvestkysten):
  https://www.visitnordvestkysten.dk/nordvestkysten/planlaeg-din-tur/surfspot-harbooere-gdk1106791
- Surfspot Høfde Q (Visit Nordvestkysten):
  https://www.visitnordvestkysten.dk/nordvestkysten/planlaeg-din-tur/surfspot-hoefde-q-gdk1106885
- Surfspots ved Agger og Høfde Q (Visit Agger): https://www.visitagger.dk/surfspots
- Kystdirektoratet, høfderne Bovbjerg–Fjaltring (feltbesøg):
  https://kyst.dk/media/q1io1szu/bwn_fieldtrip.pdf
- Surfing in Thyborøn (Sessions Travel):
  https://sessionstravel.com/destinations/denmark/surfing-in-thyboron/
- Open-Meteo Marine Weather API: https://open-meteo.com/en/docs/marine-weather-api
