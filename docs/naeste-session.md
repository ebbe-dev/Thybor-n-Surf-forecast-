# Byg Tangen — overlevering til næste session (17/10/2026, anden session)

Skrevet af Claude i den anden session 17/10/2026, så den næste session kan
starte uden samtalens hukommelse. Alt herunder er efterprøvet, medmindre der
står "skal efterprøves". Den forrige overlevering (morgenen 17/10) er
indarbejdet; det, der er gjort siden, står i afsnit 3.

## 1. Hvad det er, og hvor det ligger

- **Appen:** Byg Tangen, Ebbes surf-forecast for Harboøre Tange / Thyborøn
  (8 spots, 2 vejr-områder: `thyboroen` og `thorsminde`). PWA: Vite + React 19
  + TypeScript strict, Leaflet 1.9, vite-plugin-pwa. Dansk UI.
- **Repo:** `ebbe-dev/Thybor-n-Surf-forecast-`, gren
  `claude/byg-tangen-surf-app-yox769` (både default-gren og deploy-gren).
  Ebbe 17/10: push direkte dertil som før; sessionens egen `ccr-…`-gren
  bruges ikke. Hvert push deployer til
  <https://ebbe-dev.github.io/Thybor-n-Surf-forecast-/> via
  `.github/workflows/deploy.yml` (to job: build + deploy). Grenen
  `claude/den-thursday-display-bug-yukjqr` er død (september, PR #1-3
  lukkede, indholdet ligger på hovedgrenen); Ebbe ville ikke slette den.
- **Hård regel:** Maskinen-repoet (`ebbe-dev/maskinen`) røres ALDRIG fra
  surf-arbejdet. Start sessionen uden det.
- **Kommandoer:** `npm ci`, `npm run build` (= `tsc --noEmit && vite build`),
  `npm test` (scripts/tests/*.test.mts, 108 tjek 17/10, bundlet med rolldown,
  fordi Node ikke løser appens extensionless imports), `npm run test:shots
  <mappe>` (Playwright-skærmbilleder af NU og KORT med seedede data efter
  referencedagene, uden net; kræver `dist/`). Playwright 1.62 vil hente sin
  egen chromium; i Claude-containeren bruger scriptet `/opt/pw-browsers/chromium`.
  **Testene ligger nu i repoet** — kør `npm test` før hvert push.
- **Commit-stil:** danske beskeder, `git -c user.name="Claude" -c
  user.email="noreply@anthropic.com" commit`, trailere `Co-Authored-By` og
  `Claude-Session` (harnesset angiver dem).
- **Filer:** `src/model/model.ts` (scoren, advarslerne, `Row`),
  `src/lib/blocks.ts` (3-timers blokke, dom, rangering, horisont),
  `src/config/spots.ts` (spots, AREAS, `spotOpts`), `src/api/openMeteo.ts`
  (kerne-, ekstra- og spredningskald til marine-API'et + vind),
  `src/lib/surfHeight.ts` (fronten), `src/lib/spread.ts` (± og usikker),
  `src/lib/swell.ts` (ground/wind swell, ground swell under),
  `src/lib/water.ts` (våddragt), `src/lib/settings.ts` (horisont,
  front-kontakt), `src/api/obs.ts` + `src/hooks/useObs.ts` + `src/lib/obs.ts`
  + `src/components/MeasuredNow.tsx` (målingerne), `src/screens/*.tsx` (NU,
  KORT, HISTORIK, LOG), `src/lib/calibration.ts` (loggen),
  `docs/surf-science.md` (forskningen og hver regel, §1-15 + kilder),
  `scripts/fetch-obs.mjs` + `.github/workflows/obs.yml` (målingerne; input
  `openmeteo=true` kører `scripts/probe-openmeteo.mjs`), `scripts/tests/`
  (run.mjs, lib.mts, *.test.mts, seed.mjs, screenshots.mjs), `README.md`.
- **Netværk fra Claude-containeren:** Open-Meteo, kyst.dk, dmi.dk og github.io
  kan IKKE nås (proxy). `api.github.com` og `raw.githubusercontent.com` kan.
  Eksterne API'er prøves ved at køre et workflow i GitHub Actions og læse
  loggen (`obs.yml`: `probe=true`, `deep=true`, `openmeteo=true`). WebSearch
  virker, WebFetch ikke. gcloud i containeren er ikke logget ind.

## 2. Modellen i dag (kort)

Score = 10 · energi^0,6 · (0,35 + 0,65 · vindkvalitet) · størrelsesport · stød
· refleksion · vandstand · udblæsning. Energi = 15 · hs² · tp · skråfaktor,
normeret med `ENERGY_NORM = 170`; skråfaktoren er en cosinus strakt til
`OBLIQUE_CUTOFF = 140°` (90° ≈ 0,53). Fralandsvind er en gave til 5 m/s, fuldt
fradrag fra 12 (`OFFSHORE_*`, cos² af fralandskomponenten). Pålandsvind over
6 m/s blæser søen ud, fradrag på 70 % (faktor 0,3) fra 14. Høfdens læ = 0,75 ·
sin(vinkel mellem vind og spottets retning), kun op til 12 m/s; enkeltsidede
spots (Høfde Q sydsiden, Thorsminde) halveres på den forkerte side. Moler
(Indsejlingen, Færgehavnen, Thorsminde, `reflective`) trækker fra 1,0 m, halvt
ved 2,0 m. Vandstand over +0,4 m trækker ned (0,6 ved +1,0), under −0,6 m
lidt. Ground swell = periode ≥ 8 s på det viste tal. Rækken bærer den SAMLEDE
sø (`wave_*`), dønning, 2. dønning og vindsø som dele, perioden = den
dominerende dels topperiode. Advarsler (`caveats`) står på kortet, under
tallene og i kortets pop-up. Loggens korrektion: clamp(sum afvigelse /
(n + 6), ±2), global indtil 3 sessions pr. spot — og Ebbe har sagt, at loggen
ikke kan bære kalibreringen; reglerne kommer fra forskningen.
**Rører aldrig scoren:** målingerne, fronten, modelspredningen, ground swell
under, 2. dønning, vandtemperaturen. Alle spots regner med `spotOpts(spot)`
— også HISTORIK (rettet 17/10, 5b4f293).

## 3. Status 17/10 (anden session) — gjort, testet og live

- **HISTORIK regner som NU/KORT/LOG** (5b4f293): `computeStats` sendte kun
  fralandsretning og side; nu `spotOpts(spot)` med høfdens læ og molen.
- **Probe af Open-Meteo** (8395579, kørt i Actions, log i run 39010193894):
  `best_match` er for højden Météo-Frances MFWAM (identiske tal); `ewam` 5 km
  rækker 3,3 døgn; `gwam`, `meteofrance_wave`, `ncep_gfswave025` 7 døgn;
  `ecmwf_wam025` kun sydpunktet (tør celle ved 56,66/8,13);
  `ncep_gefswave025`, `era5_ocean`, `meteofrance_currents` ingen bølgetal.
  Flere modeller i ét kald giver nøgler `wave_height_<model>`
  (`wave_height_marine_best_match`). `secondary_swell_wave_*` findes (kun
  middelperiode), `tertiary_*` og `wave_peak_period` tomme,
  `secondary_swell_wave_peak_period` findes ikke, `sea_surface_temperature`
  findes (Météo-Frances havmodel). Vind: `best_match` er IKKE
  `dmi_seamless` (snit 1,0 m/s forskel over 48 t; tættest på ICON 0,6 m/s).
- **Tests i repoet** (266f93d): `npm test`, 108 tjek; `npm run test:shots`.
- **Bølgens front i meter** (a1bad36): Komar & Gaughan, "front 1,9 m" på
  dommen, FRONT i detaljen, kortets pop-up og stribe, under en meter i 5 cm.
  Kontakt "Vis bølgens front i meter" under Indstillinger nederst på NU
  (`bygtangen.surfheight`, standard til). Ebbe ville have tal, ikke ord.
- **Modelspredning** (165767c): ét ekstra kald med fem modeller; `hsSpread`
  på rækken; "1,5 ±0,4 m" og "usikker · 4 modeller siger 1,1–1,9 m" på
  dommen, i detaljen (med frontens spænd), i kortets skilte, pile, pop-up og
  stribe, når spændet er over 0,3 m. Dæmpet, ikke ⚠.
- **2. dønning, ground swell under, vand** (cfb50a8):
  `swell2` og `sst` på rækken fra ekstra-kaldet; mærket GROUND SWELL UNDER,
  når en lang dønning ≥ 0,3 m ligger under vindsøen; "vand 13 °C" og
  våddragts-tommelfingerregel (`lib/water.ts`).
- **Docs:** `docs/surf-science.md` §13-15 + §10/§12 opdateret, README, denne.
- **Skærmbilleder** før/efter ligger ikke i repoet (sendt til Ebbe i
  sessionen); `npm run test:shots <mappe>` laver nye på et minut.

**Målt nu** kører uændret: `obs.yml` henter Kystdirektoratets bøje 2035
(Fjaltring, UTC, `T_z`, nul = pladsholder, `enddate` eksklusiv) og DMI
`sea_reg` 9004203 og lægger `obs.json` på grenen `data`. 17/10 kl. 06.31 UTC:
95 bøjerækker, 287 vandstandsrækker, 0 fejl.

**GitHubs schedule svigter stadig.** `obs.yml` (cron `11,41 * * * *`)
affyrede 4 af 28 planlagte kørsler de første 14 timer (huller 3,7 / 2,6 /
2,6 / 4,8 t), og ingen planlagt kørsel mellem 05.35 og 06.31 UTC 17/10;
manuelle kørsler virker altid. Ebbe: "vi venter et døgn; Googles timer en
anden dag, hvis det er bedst." Dommen 17/10: GitHub er kun lige så godt, hvis
den kører hver halve time med under en halv times forsinkelse — det gør den
ikke. Opskriften, når han vil: fin-kornet PAT (kun dette repo, Actions: read
and write) + ét Cloud Scheduler-job i `ejnar-494012`, `*/30 * * * *`, der
POST'er til
`https://api.github.com/repos/ebbe-dev/Thybor-n-Surf-forecast-/actions/workflows/obs.yml/dispatches`
med body `{"ref":"claude/byg-tangen-surf-app-yox769"}` og headers
`Authorization: Bearer <PAT>`, `Accept: application/vnd.github+json`.
Tokenet læses med `read -rs` i et script, aldrig indsat i klartekst.
GitHub-schedulen bliver stående som andet lag. gcloud i containeren er ikke
logget ind, så trinnene er Ebbes: nummererede, én handling pr. trin,
kommandoer i kodeblokke. (Den første session 17/10 har en engangsopfølgning
kl. 18 dansk tid, der tjekker schedulen og rapporterer i den session; den
er ufarlig.)

## 4. Findings: hvad appen mangler (rangeret, 17/10 eftermiddag)

Gjort 17/10: surf-højde (som tal), modelspredning, sekundær dønning +
vandtemperatur, og spørgsmålet om vindmodellen er besvaret (nej, ikke DMI).
Tilbage, rangeret:

1. **Bias mod bøjen.** Kæden findes (`checkForecast`). Efter ~30 dage:
   gennemsnitlig fejl (model − bøje) pr. retningssektor og pr.
   størrelsesklasse, brugt som rettelse af højden for `thorsminde`-området
   (Thyborøn ligger 20 km nord og bag molen — ret ikke den uden egen
   måling). Vis rettelsen ("+0,1 m fra bøjen"), som loggens korrektion vises
   i dag. Pris: meget lille. Først når `obs.json` har kørt stabilt en måned —
   derfor hænger den på timeren (afsnit 3).
2. **Refraktion og fronten pr. spot.** Retningen på stranden regnet med
   Snell fra 17,5 m til brydningsdybden (~1,3 · Hb), i stedet for den
   håndsatte 140°-regel; samme regning giver fronten pr. spot i stedet for
   §13's åbne strand. Tabellen og fysikken står i `docs/surf-science.md`
   §2-3 og §13. `obliqueFactor` bruges i scoren, så kør `npm test`
   (referencedagene) for alle otte spots, før den skiftes ud. Pris: mellem.
3. **Alarm.** Et skub ("I morgen kl. 11: Langerhuse H 8,2"), når de næste
   48 t får en blok over 7. Kan køre i `obs.yml` via ntfy.sh (Ebbe
   installerer appen og abonnerer på et hemmeligt emne). Kræver, at timeren
   holder — først efter Googles timer. Pris: mellem.
4. **Vindmodellen.** `best_match` er ikke DMI's HARMONIE (proben). Om
   `models=dmi_seamless` (2 km, 2,5 døgn) rammer bedre ved kysten, kræver
   målt vind at afgøre; Thyborøn Havn viser den (web, uden API). En
   vind-spredning som bølgernes (best_match mod DMI mod ICON) er billig at
   vise, men endnu et tal. Pris: lille til mellem.
5. **Tidevandskurve** på barografen med målt vandstand oven på. Tidevandet
   er kun en halv meter ved Thyborøn, så lav prioritet. Pris: lille.

**Lad være:** kameraer (der er intet på Tangen), 16-dages forecast (alt
efter dag 5 er gæt), flere modelpunkter (samme model, samme fejl),
brugerkarakterer, at sammenligne bøjens T_z med appens T_p, at lade
målinger eller modelspredning ændre scoren, og at vise flere tal på dommen
end nu (den har højde ± front, periode, vind, vand — LARS' kerne: én
sætning, ikke fire tal).

## 5. Regler lært i sessionerne (hold dem)

- Ebbes ønsker til kortet: **intet må overlappe** (pile, skilte, LÆ-mærker,
  chips), og **dobbelttryk** på et spot på NU åbner kortet på spottet til
  tidspunktet **uden pop-up**. Konstanter: ARROW_BOX 330, WAVE_R_FAR 150,
  LEE_ZOOM 15, FOCUS_ZOOM 15, SIGN_H 94 (matcher `.sign` i styles.css).
- Høfde Q surfes på **sydsiden** (Visit Agger); `fixedSide: "syd"` beholdes.
- 13/10 (Langerhuse H, sydbølge, sydvind 10 m/s, "helt fantastisk") og 14/10
  (Q, vestenvind 12 m/s, "blæst ud") er de to referencedage for læ og
  udblæsning; 11/10 (Indsejlingen, fralandsvind 10 m/s, 2 m, "knækkede for
  langt inde / spist af molen") for hård fraland og refleksion; 26/7
  (Sneglehuset, 1,3 m / 6,7 s, en 10'er) er ankeret. Alle fire står i
  `scripts/tests/model.test.mts`.
- Ændrer du scoren: forklar faktor for faktor, hvorfor et tal blev, som det
  blev. Det, der vises uden for scoren (front, ±, under, vand, målt), må
  aldrig sive ind i den.
- Tal frem for ord på dommen (Ebbe 17/10 om fronten). ± kun når modellerne
  er uenige over 0,3 m; "usikker" dæmpet, ikke ⚠. Kontakter til visning
  hører under Indstillinger nederst på NU.
- GitHubs schedule er best-effort. Deploy i to job. KDI: enddate eksklusiv,
  UTC, nul = pladsholder. DMI: `sea_reg`. Ingen CORS hos nogen af dem.
  Open-Meteo: `best_match` = MFWAM for højden her; efterprøv nye
  variabler/modeller med `openmeteo=true` i `obs.yml` først.
- Beslutninger til Ebbe stilles som klikbare spørgsmål, anbefalingen først.
  Skriv aldrig "færdig", mens noget venter på ham. Trin til ham: nummererede,
  én handling pr. trin, kommandoer i kodeblokke, kun de trin der kan gøres nu.
- Før/efter-skærmbilleder med `npm run test:shots` ved UI-ændringer; `npm
  test` før hvert push.

## 6. Forslag til første besked i den nye session

> Læs `docs/naeste-session.md` og `docs/surf-science.md` i surf-repoet
> (`ebbe-dev/Thybor-n-Surf-forecast-`, gren `claude/byg-tangen-surf-app-yox769`,
> push direkte dertil). Rør ikke Maskinen. Kør `npm ci && npm test` først.
> Start med afsnit 4, punkt 2 (refraktion og fronten pr. spot) — kør
> referencedagene i `npm test` før og efter. Byg, test i browseren med
> `npm run test:shots`, commit, push, og vis mig før/efter-skærmbilleder.
