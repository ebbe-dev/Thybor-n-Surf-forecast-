# Byg Tangen — overlevering til næste session (17/10/2026)

Skrevet af Claude i sessionen 10-17/10/2026, så den næste session kan starte
uden Maskinen-repoet og uden samtalens hukommelse. Alt herunder er efterprøvet
i den session, medmindre der står "skal efterprøves".

## 1. Hvad det er, og hvor det ligger

- **Appen:** Byg Tangen, Ebbes surf-forecast for Harboøre Tange / Thyborøn
  (8 spots, 2 vejr-områder: `thyboroen` og `thorsminde`). PWA: Vite + React 19
  + TypeScript strict, Leaflet 1.9, vite-plugin-pwa. Dansk UI.
- **Repo:** `ebbe-dev/Thybor-n-Surf-forecast-`, gren
  `claude/byg-tangen-surf-app-yox769` (både default-gren og deploy-gren). Hvert
  push deployer til <https://ebbe-dev.github.io/Thybor-n-Surf-forecast-/> via
  `.github/workflows/deploy.yml` (to job: build lægger `dist` op, deploy lægger
  ud — ét job gav "0 artifacts" to gange 16/10, og en genkørsel gav et artefakt
  nr. 2).
- **Hård regel:** Maskinen-repoet (`ebbe-dev/maskinen`) røres ALDRIG fra
  surf-arbejdet. Start sessionen uden det.
- **Kommandoer:** `npm run build` (= `tsc --noEmit && vite build`),
  `npx vite preview --port 4173 --strictPort`. Ingen testramme i repoet.
- **Tests fra sessionen lå i scratchpad og er væk.** De dækkede: `rules.mts`
  (50 tjek af modellen, kørt som esbuild-bundle, fordi Node ikke løser
  extensionless imports), `obs.mts` (35 tjek af målinger mod forecast), og
  Playwright-browsertests (chromium i `/opt/pw-browsers/chromium`, viewport
  412×915, `timezoneId: Europe/Copenhagen`, `serviceWorkers: "block"`), der
  seeder localStorage `bygtangen.forecast3` (14 dages rækker) og
  `bygtangen.obs1`, og blokerer `open-meteo.com`, `tile.openstreetmap.org` og
  `raw.githubusercontent.com` med `ctx.route`. **Læg nye tests i repoet under
  `scripts/tests/`**, så de overlever sessionen. Playwright er devDependency.
- **Commit-stil:** danske beskeder, `git -c user.name="Claude" -c
  user.email="noreply@anthropic.com" commit`, trailere `Co-Authored-By` og
  `Claude-Session` (harnesset angiver dem).
- **Filer:** `src/model/model.ts` (scoren og advarslerne), `src/lib/blocks.ts`
  (3-timers blokke, dom, rangering, horisont), `src/config/spots.ts` (spots,
  AREAS, `spotOpts`), `src/api/openMeteo.ts` (tre Open-Meteo-kald, rækken =
  samlet sø), `src/api/obs.ts` + `src/hooks/useObs.ts` + `src/lib/obs.ts` +
  `src/components/MeasuredNow.tsx` (målingerne), `src/screens/*.tsx` (NU, KORT,
  HISTORIK, LOG), `src/lib/calibration.ts` (loggen), `src/lib/swell.ts`
  (ground/wind swell), `docs/surf-science.md` (forskningen og hver regel med
  konstanter, §1-12 + kilder), `scripts/fetch-obs.mjs` +
  `.github/workflows/obs.yml` (målingerne), `README.md`.
- **Netværk fra Claude-containeren:** Open-Meteo, kyst.dk, dmi.dk og github.io
  kan IKKE nås (proxy). `api.github.com` og `raw.githubusercontent.com` kan.
  Eksterne API'er prøves ved at køre et workflow i GitHub Actions og læse
  loggen (`obs.yml` har `probe=true` og `deep=true`). WebSearch virker,
  WebFetch ikke.

## 2. Modellen i dag (kort)

Score = 10 · energi^0,6 · (0,35 + 0,65 · vindkvalitet) · størrelsesport · stød
· refleksion · vandstand · udblæsning. Energi = 15 · hs² · tp · skråfaktor,
normeret med `ENERGY_NORM = 170`; skråfaktoren er en cosinus strakt til
`OBLIQUE_CUTOFF = 140°` (90° ≈ 0,53). Fralandsvind er en gave til 5 m/s, fuldt
fradrag fra 12 (`OFFSHORE_*`, cos² af fralandskomponenten). Pålandsvind over
6 m/s blæser søen ud, fuldt (×0,7) fra 14. Høfdens læ = 0,75 · sin(vinkel
mellem vind og spottets retning), kun op til 12 m/s; enkeltsidede spots (Høfde
Q sydsiden, Thorsminde) halveres på den forkerte side. Moler (Indsejlingen,
Færgehavnen, Thorsminde, `reflective`) trækker fra 1,0 m, halvt ved 2,0 m.
Vandstand over +0,4 m trækker ned (0,6 ved +1,0), under −0,6 m lidt. Ground
swell = periode ≥ 8 s på det viste tal. Rækken bærer den SAMLEDE sø
(`wave_*`), dønning og vindsø som dele, perioden = den dominerende dels
topperiode. Advarsler (`caveats`) står på kortet, under tallene og i kortets
pop-up. Loggens korrektion: clamp(sum afvigelse / (n + 6), ±2), global indtil
3 sessions pr. spot — og Ebbe har sagt, at loggen ikke kan bære
kalibreringen ("jeg får ikke surfet nok"); reglerne kommer fra forskningen.

## 3. Status 17/10

**Målt nu er bygget, testet og live** (commit 03bb9b2 og frem):

- Kystdirektoratets bølgemåler ved Fjaltring: **ident 2035** (aktiv siden
  18/8-2023; 2031 var den gamle, samme sted, UTM32 441896/6259258, 17,5 m).
  Tjeneste: `https://kystatlas.kyst.dk/data/boelge/response.aspx?ident=2035&startdate=ÅÅÅÅMMDD&enddate=ÅÅÅÅMMDD&format=csv`.
  **`enddate` er eksklusiv** ud over kl. 00:00 (dagen i dag kræver "i morgen").
  **`Datotid` er UTC** (prøvet mod Open-Meteo forskudt −6..+6 t: minimum ved 0).
  `T_s` står som **0 = pladsholder**; perioden er `T_z` (middelperioden,
  20-30 % under topperioden). `H_M0` er højden, `H_max`/`T_max` findes.
- DMI's vandstand: `opendataapi.dmi.dk/v2/oceanObs`, station **9004203
  Thyborøn Kyst**, parameter **`sea_reg`** (`sealev_dvr`/`sealev_ln` svarer
  tomt), cm over DVR90 hvert 10. minut. Havn 9004201 stoppede april 2026.
- Hverken kyst.dk eller DMI sender CORS-hoveder → `obs.yml` henter og lægger
  `obs.json` (48 t) på grenen `data`; appen læser
  `https://raw.githubusercontent.com/ebbe-dev/Thybor-n-Surf-forecast-/data/obs.json`
  (5 min CDN-cache). Fail-open med cache `bygtangen.obs1`.
- I appen: kortet **Målt nu** på NU (bøje, vandstand, klokkeslæt, "gammel" over
  3 t, "offline · hentet …"), **"målt …"** under bølge/periode/retning/vandstand
  i detaljen (kun passerede blokke, ±45 min bøje, ±20 min vandstand), og
  MÅLT-linjer i kortets stribe (nu og næste time får den seneste måling).
  **Modellen mod bøjen**: forecastens højde for `thorsminde` mod bøjen,
  måling for måling, 48 t, mindst 3 par; **kun højden** (T_z ≠ T_p).
  Målt 16/10: modellen lå ~0,1 m under bøjen, spredning 0,107 m.
- **Målingerne rører aldrig scoren.** Det er en regel.

**GitHubs schedule svigter.** `obs.yml` (cron `11,41 * * * *`, ændret fra
`7,37` for at få den registreret igen) affyrede 4 af 28 planlagte kørsler de
første 14 timer, huller på 2,6 / 2,6 / 4,8 t; manuelle kørsler virker altid.
Ebbe 17/10: "vi venter et døgn; Googles timer en anden dag, hvis det er
bedst." Dommen 17/10 kl. 07.45: GitHub er KUN lige så godt, hvis den kører
hver halve time med under en halv times forsinkelse — det gjorde den ikke.
Opskriften, når han vil: fin-kornet PAT (kun dette repo, Actions: read and
write) + ét Cloud Scheduler-job i `ejnar-494012`, `*/30 * * * *`, der POST'er
til `https://api.github.com/repos/ebbe-dev/Thybor-n-Surf-forecast-/actions/workflows/obs.yml/dispatches`
med body `{"ref":"claude/byg-tangen-surf-app-yox769"}` og headers
`Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`.
Tokenet læses med `read -rs` i et script, aldrig indsat i klartekst
(Maskinen-lærdom 7/10). GitHub-schedulen bliver stående som andet lag. Trin
til Ebbe skrives nummererede, én handling pr. trin, kommandoer i kodeblokke.
(Den gamle session har en planlagt opfølgning 17/10 kl. 18 dansk tid; den
kører dér og er ufarlig.)

## 4. Findings: hvad appen mangler (rangeret, 17/10)

Holdt op mod Surfline (kameraer, redaktion, "surf height", surf alerts),
Windy og Windguru (flere modeller side om side), Surf-forecast.com, Swell
Intel (nearshore) og LazySurfer (sessions). Målet er præcis OG hurtig at
aflæse. Appen har allerede det, de store ikke har for denne kyst: dommen,
høfdens læ, molerne, vandstanden og bøjen at måle sig mod.

1. **Surf-højde i ord i stedet for Hs.** Hs er havets tal (det, bøjen ser på
   17,5 m); surferen læser bølgens front på stranden. Komar & Gaughan (1972):
   `Hb = 0,39 · g^(1/5) · (T · H0²)^(2/5)` (linear teori, breaker-indeks 0,78;
   uden refraktion og friktion). 1,5 m giver ~1,7 m front ved 6 s og ~2,1 m
   ved 10 s — perioden laver bølgen. Vis det som ord på dommen
   ("knæhøj / hoftehøj / skulderhøj / hovedhøj / over hovedet", front-skala)
   og lad loggens STØRRELSE-skyder (0 = for småt, 5 = perfekt, 10 = for
   stort) kalibrere grænserne. Scoren bruger stadig hs²·tp. Pris: lille.
2. **Modelspredning.** Open-Meteo marine har flere bølgemodeller i ét kald
   via `models=`: DWD EWAM 5 km (3 døgn) / GWAM 28 km = `best_match` i dag,
   Météo-France MFWAM (ECMWF-vind, ~8 km), ECMWF WAM 0,25°, NCEP GFS Wave.
   Hent 3 modeller for de to punkter, vis "1,5 m ±0,4" når de er uenige
   over 0,3 m, og ton dommen ned ("usikker"). Det ærligste præcisionsmål,
   især dag 3-7. Pris: ét ekstra kald. **Modelnavnene skal efterprøves med en
   probe fra GitHub Actions** (dokumentationen nævner dem; containeren når
   ikke tjenesten).
3. **Bias mod bøjen.** Kæden findes. Efter ~30 dage: gennemsnitlig fejl
   (model − bøje) pr. retningssektor og pr. størrelsesklasse, brugt som
   rettelse af højden for `thorsminde`-området (Thyborøn ligger 20 km nord og
   bag molen — ret ikke den uden egen måling). Vis rettelsen ("+0,1 m fra
   bøjen"), som loggens korrektion vises i dag. Pris: meget lille.
4. **Sekundær dønning + vandtemperatur i samme kald.** Open-Meteo marine
   dokumenterer `secondary_swell_wave_*`/`tertiary_swell_wave_*` (ECMWF WAM /
   MFWAM) og `sea_surface_temperature` (Météo-France 8 km). En 9 s ground
   swell under 1,5 m vindsø skilles ud, så mærket "ground swell" rammer
   oftere; "11 °C → 4/3 og støvler" på forsiden. **Variabelnavne skal
   efterprøves.** Pris: lille.
5. **Refraktion.** Retningen på stranden regnet med Snell fra 17,5 m (bøjens
   dybde) til brydningsdybden (~1,3 · Hb), i stedet for den håndsatte
   140°-regel. Tabellen og fysikken står i `docs/surf-science.md` §2-3.
   Præcis på dage som 13/10 med bølger langs kysten. Pris: mellem; husk, at
   `parseMarketFromCampaignName`-lignende sidegevinster ikke findes her — men
   `obliqueFactor` bruges i scoren OG i leeCaption-logikken, så test begge.
6. **Alarm.** Et skub ("I morgen kl. 11: Langerhuse H 8,2"), når de næste
   48 t får en blok over 7. Kan køre i `obs.yml` (den regner allerede hver
   halve time) via en gratis push-tjeneste som ntfy.sh (Ebbe installerer
   appen og abonnerer på et hemmeligt emne). Kræver, at timeren holder —
   først efter Googles timer. Pris: mellem.
7. **Tidevandskurve** på barografen med målt vandstand oven på. Tidevandet
   er kun en halv meter ved Thyborøn, så lav prioritet. Pris: lille.
8. **Vindmodellen:** Open-Meteo bruger DMI's HARMONIE 2 km i `best_match`
   for Nordeuropa (ifølge Open-Meteos egen meddelelse), så den er nok allerede
   i brug. Efterprøv med ét kald: `best_match` mod `models=dmi_seamless` for
   56,68 N 8,20 Ø; er de ens, er der intet at gøre.

**Lad være:** kameraer (der er intet på Tangen; nærmeste er Vorupør 24 km
væk), 16-dages forecast (alt efter dag 5 er gæt), flere modelpunkter (samme
model, samme fejl — det er målinger, der giver mere), brugerkarakterer, at
sammenligne bøjens T_z med appens T_p, og at lade målinger ændre scoren.

**LARS' kerne (17/10):** det, der giver mest, er at holde op med at vise tal,
en surfer skal omregne i hovedet. "1,5 m / 7 s fra VNV" er fire tal;
"skulderhøj, ground swell på kanten, fralandsvind" er én sætning. Og vis
hellere "±0,4 m" end én decimal: en forecast uden usikkerhed er præcis på
papiret og forkert i vandet.

## 5. Regler lært i sessionen (hold dem)

- Ebbes ønsker til kortet: **intet må overlappe** (pile, skilte, LÆ-mærker,
  chips), og **dobbelttryk** på et spot på NU åbner kortet på spottet til
  tidspunktet **uden pop-up**. Konstanter: ARROW_BOX 330, WAVE_R_FAR 150,
  LEE_ZOOM 15, FOCUS_ZOOM 15, SIGN_H 94 (matcher `.sign` i styles.css).
- Høfde Q surfes på **sydsiden** (Visit Agger: indersiden af den sydvendte
  mole, N-NNØ-vind); `fixedSide: "syd"` beholdes.
- 13/10 (Langerhuse H, sydbølge, sydvind 10 m/s, "helt fantastisk") og 14/10
  (Q, vestenvind 12 m/s, "blæst ud") er de to referencedage for læ og
  udblæsning; 11/10 (Indsejlingen, fralandsvind 10 m/s, 2 m, "knækkede for
  langt inde / spist af molen") for hård fraland og refleksion.
- Ændrer du scoren: forklar faktor for faktor, hvorfor et tal blev, som det
  blev ("Du behøver ikke lave om i resultatet" var svaret på et 10-tal).
- GitHubs schedule er best-effort. Deploy i to job. KDI: enddate eksklusiv,
  UTC, nul = pladsholder. DMI: `sea_reg`. Ingen CORS hos nogen af dem.
- Beslutninger til Ebbe stilles som klikbare spørgsmål, anbefalingen først.
  Skriv aldrig "færdig", mens noget venter på ham. Trin til ham: nummererede,
  én handling pr. trin, kommandoer i kodeblokke, kun de trin der kan gøres nu.

## 6. Forslag til første besked i den nye session

> Læs `docs/naeste-session.md` og `docs/surf-science.md` i surf-repoet
> (`ebbe-dev/Thybor-n-Surf-forecast-`, gren `claude/byg-tangen-surf-app-yox769`).
> Rør ikke Maskinen. Start med punkt 1 i afsnit 4 (surf-højde i ord), derefter
> punkt 2 (modelspredning) — efterprøv modelnavnene med en probe i
> `obs.yml` først. Læg tests i `scripts/tests/`. Byg, test i browseren med
> Playwright, commit, push, og vis mig før/efter-skærmbilleder.
