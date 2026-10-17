// NU: dommen øverst som swipebare spot-kort (bedste først, med scoren
// time for time), rangeringen af alle spots, og ugen for det valgte spot
// (chips → barograf → tal + høfde-planview). Horisonten (2 døgn / 7 dage)
// vælges på kortene og huskes. Forklaringerne bor bag ?-knappen i toppen.

import { useMemo, useRef, useState } from "react";
import { useForecast } from "../hooks/useForecast";
import { useObs } from "../hooks/useObs";
import type { Obs } from "../api/obs";
import { buoyAt, buoyPeriod, levelAt, fmtObsClock } from "../lib/obs";
import { MeasuredNow } from "../components/MeasuredNow";
import { SPOTS, effectiveNormal, checkedOnMapAt, isOverridden, type Spot } from "../config/spots";
import {
  buildDays,
  rankSpots,
  hourlyBlocks,
  horizonDates,
  leeCaption,
  blockCaveats,
  nowLocalIso,
  type Block,
  type HorizonDays
} from "../lib/blocks";
import { loadHorizonDays, saveHorizonDays, loadSurfHeightOn, saveSurfHeightOn } from "../lib/settings";
import { frontOf, fmtSurfHeight } from "../lib/surfHeight";
import { scoreColor } from "../lib/colors";
import { fmtClock, fmtDayLabel, todayIso } from "../lib/time";
import { fmt, fmtLevel, compass } from "../lib/format";
import type { Row } from "../model/model";
import { sunTimes, fmtSunHour } from "../lib/sun";
import { SpotCards } from "../components/SpotCards";
import { Barograph } from "../components/Barograph";
import { GroynePlan } from "../components/GroynePlan";
import { Info, Legend } from "../components/Info";
import { QuickPick } from "../components/QuickPick";
import { ScreenHeader } from "../components/ScreenHeader";
import { SpotChips } from "../components/SpotChips";
import { SwellChip } from "../components/SwellChip";
import { SwellGauge } from "../components/SwellGauge";
import { GROUND_SWELL_MIN_TP } from "../lib/swell";
import { correctionFor } from "../lib/calibration";

function fmtFetched(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NuHelp() {
  return (
    <>
      <Info q="Hvad betyder dommen?">
        <p>
          Dommen er appens svar på hovedspørgsmålet: <strong>hvornår skal du køre derud, og til
          hvilken mole.</strong> Den finder det bedste 3-timers tidsrum i dagslys inden for
          horisonten på tværs af alle spots. Det er det forreste kort og listens øverste række,
          med side og tal.
        </p>
        <p>
          <strong>Horisonten</strong> vælger du øverst på kortet: <strong>2 døgn</strong> er
          resten af i dag og hele i morgen, <strong>7 dage</strong> er hele ugen. Valget gælder
          dommen, listen og graferne, og det huskes.
        </p>
        <p>
          <strong>Tryk to gange</strong> på et spot, på kortet øverst eller i listen, og KORT
          åbner på spottet til det tidspunkt med pile og læ. <strong>Swipe kortet</strong>{" "}
          til siden for det næste spot i rækkefølgen — ugen nedenunder følger med. <strong>Grafen</strong> på kortet er spottets score time for
          time fra nu til horisontens ende: bunden er 0 og toppen 10 på alle kort, fladen har
          skalaens farver, nætterne er mørke, og prikken er det vindue, kortet handler om. Den
          lyse stribe under grafen er timerne med ground swell.
        </p>
        <p>
          <strong>"Læ på nordsiden"</strong> betyder: gå i vandet på nordsiden af høfden. Det er
          den side, vinden ikke roder op, så vandet er glattest der.
        </p>
        <p>Scoren går fra 0 til 10, og farverne betyder det samme i hele appen:</p>
        <Legend />
        <p>
          Spots mærket <strong>ukalibreret</strong> regner med en retning, vi endnu ikke har
          efterprøvet i virkeligheden. Tag deres tal med et gran salt.
        </p>
        <p>
          Linjen under ugens chips viser, hvilken vej spottet vender — den retning scoren regner
          med. <strong>"Et gæt"</strong> betyder, at retningen aldrig er efterprøvet;{" "}
          <strong>"appens værdi"</strong> at den er sat i appen. Knappen{" "}
          <strong>Tjek på kortet</strong> zoomer ind på spottet, så du kan trække prik og pil på
          plads og bekræfte sted og retning. Er spottet bekræftet, hedder knappen{" "}
          <strong>Ret på kortet</strong> og åbner tjekket igen, og panelet kan sætte tilbage til
          appens værdi. Scoren regner med den nye retning med det samme.
        </p>
      </Info>
      <Info q="Hvordan læser jeg listen?">
        <p>
          Listen rangerer alle spots efter deres <strong>bedste vindue i dagslys i dag og i
          morgen</strong>. Tidspunktet ud for hvert spot er det bedste tidspunkt at gå ud dér.
          Øverst står svaret på "hvor skal jeg hen?", nederst dagens taber.
        </p>
        <p>
          Pillen viser scoren i appens faste farver, så det bedste spot kan stadig være en "bliv
          hjemme"-dag. Tryk på en række for at se spottets uge nedenunder.
        </p>
        <p>
          Blokke uden mindst én times dagslys (solopgang og -nedgang beregnes for hver dag) er
          sorteret fra, også i dommen.
        </p>
      </Info>
      <Info q="Sådan læser du søjlerne">
        <p>
          Hver søjle er et 3-timers tidsrum (kl. 05, 08, 11, 14, 17 og 20). Der er 7 dage frem
          og 7 dage tilbage: <strong>stryg til venstre</strong> for at se frem, og{" "}
          <strong>til højre</strong> for ugen, der gik (nedtonet). Jo højere og "varmere" søjlen
          er, jo bedre forhold. "nu" markerer den blok, du står i.
        </p>
        <p>
          <strong>Pilen over søjlen</strong> viser, hvor vinden blæser <em>hen</em> (op = mod
          nord). Peger pilen ud mod havet, er det offshore, og det glatter bølgerne. Peger den ind
          mod land, roder den dem sammen.
        </p>
        <p>
          En <strong>lys bund</strong> under en søjle er ground swell i den blok. Et tomt felt
          med stiplet kant betyder, at vejrtjenesten mangler data for de timer. Det er et hul,
          ikke fladt hav. <strong>Tryk på en søjle</strong> for tallene bag og en tegning af
          høfden med vindretning og læside.
        </p>
      </Info>
      <Info q="Hvad betyder tallene og tegningen?">
        <p>
          <strong>Ground swell eller wind swell</strong> står øverst under tallene, ved tallene
          på kortet øverst og på skiltene på KORT. Appen afgør det af perioden: fra{" "}
          {GROUND_SWELL_MIN_TP} s og op er det <SwellChip tp={GROUND_SWELL_MIN_TP} /> — lange,
          ordnede bølger rejst af et blæsevejr langt væk, det bedste. Under er det{" "}
          <SwellChip tp={GROUND_SWELL_MIN_TP - 1} /> — kortere bølger, som vinden har rejst tæt
          på. Skalaen under mærket viser, hvor perioden ligger i forhold til grænsen, så du kan
          se, om det er lige på kanten.
        </p>
        <p>
          <strong>Bølge</strong> er den samlede bølgehøjde i meter, som DMI's kort også viser den.
          Under skalaen står, hvad søen består af: <strong>dønning</strong>, rejst af et blæsevejr
          langt væk, og <strong>vindsø</strong>, rejst af vinden her, hver med højde, periode og
          retning. Perioden ved mærket er den dominerende dels topperiode, for en blandet søs
          middelperiode trækkes ned af vindsøen.
        </p>
        <p>
          <strong>Front</strong> er bølgens højde, når den bryder på revlen: det tal, du ser fra
          stranden. Den regnes af bølgehøjden og perioden ude på havet (Komar & Gaughan, 1972) for
          en åben strand uden høfder og revler. Perioden laver bølgen: 1,5 m giver omkring 1,7 m
          front ved 6 s og 2,1 m ved 10 s. Scoren bruger den ikke. Den kan slås fra under
          Indstillinger nederst.
        </p>
        <p>
          <strong>Periode</strong> er sekunder mellem bølgerne. Høj periode (8+) = kraft og
          orden. Lav (4–5) = tætpakket plaskeri.
        </p>
        <p>
          <strong>Bølgeretning</strong> og <strong>vind</strong> er der, hvor bølge og vind kommer{" "}
          <em>fra</em>. En bølge ret på kysten tæller fuldt; en bølge langs kysten tæller omkring
          halvt, for den bøjer ind mod stranden på det lave vand, og først en bølge, der kommer
          bagfra, tæller slet ikke. Løber bølgerne langs kysten, vælger du størrelsen ved at gå
          nord eller syd: sydpå er man mest udsat, nordpå skygger Thyborøns mole.{" "}
          <strong>Stød</strong> er vindstødene. Over 14 m/s trækker de fra i scoren.
        </p>
        <p>
          <strong>Fralandsvind</strong> er en gave op til omkring 5 m/s. Over det holder den
          bølgerne oppe, så de knækker sent og tæt på stranden, og man kan ikke padle ind i dem;
          fra 12 m/s er fradraget fuldt. <strong>Pålandsvind</strong> dæmper, og over 6 m/s lige
          på land blæser den søen ud; fra 14 m/s er fradraget fuldt. Sidevind går fri, for der
          giver høfden læ, og man går på læsiden. <strong>Vandstand</strong> er vejrtjenestens vandstand i
          forhold til middel: tidevand og lufttryk, ikke en stormflodsmodel. Tidevandet ved
          Thyborøn er kun en halv meter; det er vinden, der flytter vandet. Over +0,4 m ruller
          bølgerne over revlen og knækker inde ved stranden, under −0,6 m knækker de langt ude.
        </p>
        <p>
          <strong>Advarslerne</strong> øverst i tallene er de regler, der trækker scoren ned lige
          nu: hård fralandsvind, hård pålandsvind, høj eller lav vandstand, og ved Indsejlingen, Færgehavnen og
          Thorsminde en mole, der kaster store bølger tilbage, så den udadgående bølge spiser den
          næste. Reglerne og forskningen bag dem står i appens vidensfil (docs/surf-science.md).
        </p>
        <p>
          <strong>Målt</strong> under et tal er det, havet faktisk gjorde på det tidspunkt:
          bøjen ved Fjaltring (højde, periode, retning) og vandstanden ved Thyborøn Kyst, når
          der findes en måling inden for en halv times tid af blokken. Se "Hvad er målt nu?".
        </p>
        <p>
          <strong>Tegningen</strong> er høfden set fra oven, nord er op. Det mørke er land, den lyse
          streg er høfden, og N og S står på dens to sider. Pilen <strong>VIND</strong> kommer ind
          fra den vej, vinden blæser fra (tallet er m/s); de stiplede pile er bølgerne. Det lyse
          felt mærket <strong>LÆ</strong> er høfdens vindskygge: der er vandet glattest, og det er
          den side, teksten mener med "læ på nordsiden". Blæser vinden lige ind på kysten eller
          lige ud fra land, bliver feltet smalt — så giver høfden ingen læ. Samme felt ligger på
          kortet.
        </p>
      </Info>
      <Info q="Hvad er målt nu?">
        <p>
          Kortet <strong>Målt nu</strong> viser det, havet faktisk gør, ved siden af forecasten.{" "}
          <strong>Bøjen ved Fjaltring</strong> er Kystdirektoratets bølgemåler ud for Høfde Q på
          17,5 m vand: bølgehøjde, periode og retning hver halve time, og den største enkeltbølge
          i den halve time. <strong>Vandstanden</strong> måles ved Thyborøn Kyst hvert 10. minut
          og står i forhold til middel. Klokkeslættet er målingens eget. Tallene hentes hver
          halve time; uden net står de sidst hentede med deres tidspunkt.
        </p>
        <p>
          Bøjen angiver <strong>middelperioden</strong> (T<sub>z</sub>), appen bruger{" "}
          <strong>topperioden</strong>. Middelperioden ligger typisk 20–30 % under: 6,5 s i middel
          ved bøjen er omkring 8 s i top, altså ground swell. Derfor står der "middel" ved bøjens
          periode, og derfor sammenlignes perioden ikke med modellen.
        </p>
        <p>
          <strong>Modellen mod bøjen</strong> holder forecastens bølgehøjde for det sydlige
          vejr-område op mod bøjen over de sidste to døgn, måling for måling: "+0,3 m i snit"
          betyder, at modellen har ligget 0,3 m over havet; spredningen er den gennemsnitlige
          afvigelse uanset fortegn. Ligger modellen over, er dagens tal nok også for høje. Tallet
          rører ikke scoren — det fortæller, hvor meget du skal tro på den.
        </p>
        <p>
          Bøjen ligger 20 km syd for Thyborøn. Ved Thyborøn-spots er den stadig den nærmeste
          måling af søen udenfor, men molen og Tangen former bølgerne derfra og ind.
        </p>
      </Info>
    </>
  );
}

// "10/10" fra et ISO-tidspunkt — til "bekræftet på kortet 10/10".
function fmtDayMonth(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

// Sted og retning for spottet: én linje med retningen og dens status, og
// en knap, der åbner kortet zoomet ind på spottet (App skifter fane). Dér
// trækkes prik og pil på plads, og bekræftelsen gemmes på telefonen
// (config/spots.ts). Findes på alle spots, og kan altid åbnes igen —
// retningen er det, scoren regner med.
function SpotCheck({ spot, onCheck }: { spot: Spot; onCheck: () => void }) {
  const current = effectiveNormal(spot);
  const checked = checkedOnMapAt(spot);
  const status = checked
    ? ` · bekræftet på kortet ${fmtDayMonth(checked)}${isOverridden(spot) ? ", rettet" : ""}`
    : spot.adjustableNormal
      ? " · et gæt — tjek sted og retning på kortet"
      : " · appens værdi";
  return (
    <div className="card normal-setting">
      <div className="normal-line">
        <span>
          Spottet vender mod <strong>{compass(current)} {current}°</strong>
          <span className="muted">{status}</span>
        </span>
        <button className="btn-ghost btn-sm" onClick={onCheck}>
          {checked ? "Ret på kortet" : "Tjek på kortet"}
        </button>
      </div>
    </div>
  );
}

// Delene af søen i ord: "dønning 1,2 m / 9,0 s NV · vindsø 0,8 m / 4,5 s S".
function waveParts(r: Row): string {
  const parts: string[] = [];
  if (r.swell) parts.push(`dønning ${fmt(r.swell.hs)} m / ${fmt(r.swell.tp)} s ${compass(r.swell.dir)}`);
  if (r.windSea) parts.push(`vindsø ${fmt(r.windSea.hs)} m / ${fmt(r.windSea.tp)} s ${compass(r.windSea.dir)}`);
  return parts.length ? parts.join(" · ") : "dønning og vindsø: ikke opdelt af kilden";
}

function BlockDetail({
  block,
  spot,
  obs,
  showFront
}: {
  block: Block;
  spot: Spot;
  obs: Obs | null;
  showFront: boolean;
}) {
  const r = block.row;
  const warnings = blockCaveats(spot, block);
  const color = scoreColor(block.score);
  const cal = correctionFor(spot.id);
  // målt på blokkens tidspunkt (lib/obs.ts) — kun når en måling findes
  // inden for vinduet; fremtiden har ingen
  const mb = buoyAt(obs, block.time);
  const ml = levelAt(obs, block.time);
  const mbPer = mb ? buoyPeriod(mb) : null;
  return (
    <section className="card detail">
      <header className="detail-head">
        <span>
          {fmtDayLabel(block.time)} kl. {fmtClock(block.time)} · {spot.shortName}
        </span>
        <span className="detail-score" style={{ color }}>
          {fmt(block.score)}
        </span>
      </header>
      {Math.abs(cal.correction) >= 0.05 && (
        <p className="cal-note">
          inkl. {cal.correction >= 0 ? "+" : ""}
          {fmt(cal.correction)} lært af dine {cal.n} sessions
        </p>
      )}
      {warnings.length > 0 && (
        <ul className="caveats">
          {warnings.map((c) => (
            <li key={c.key}>{c.text}</li>
          ))}
        </ul>
      )}
      <div className="detail-body">
        <div className="swell-block">
          <div className="swell-line">
            <SwellChip tp={r.tp} big />
            <span className="swell-tp">{fmt(r.tp)} s</span>
          </div>
          <SwellGauge tp={r.tp} />
          <div className="wave-parts">{waveParts(r)}</div>
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Bølge</dt>
            <dd>
              {fmt(r.hs)} m
              {mb && <span className="dd-note meas">målt {fmt(mb.hs)} m {fmtObsClock(mb.time)}</span>}
            </dd>
          </div>
          {showFront && (
            <div>
              <dt>Front</dt>
              <dd>
                {fmtSurfHeight(frontOf(r))}
                <span className="dd-note">på revlen, af højde og periode</span>
              </dd>
            </div>
          )}
          <div>
            <dt>Periode</dt>
            <dd>
              {fmt(r.tp)} s
              {mbPer && (
                <span className="dd-note meas">
                  målt {fmt(mbPer.s)} s{mbPer.kind === "middel" ? " middel" : ""}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Bølgeretning</dt>
            <dd>
              {compass(r.swdir)} {Math.round(r.swdir)}°
              {mb?.dir != null && (
                <span className="dd-note meas">
                  målt {compass(mb.dir)} {Math.round(mb.dir)}°
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Vind</dt>
            <dd>
              {compass(r.wdir)} {fmt(r.wspd)} m/s
            </dd>
          </div>
          <div>
            <dt>Stød</dt>
            <dd>{fmt(r.gust)} m/s</dd>
          </div>
          <div>
            <dt>Luft</dt>
            <dd>{r.temp == null ? "—" : fmt(r.temp) + " °C"}</dd>
          </div>
          <div>
            <dt>Vandstand</dt>
            <dd>
              {r.level == null ? "—" : fmtLevel(r.level)}
              <span className="dd-note">{r.level == null ? "ikke oplyst" : "ift. middel"}</span>
              {ml && <span className="dd-note meas">målt {fmtLevel(ml.m, 2)} {fmtObsClock(ml.time)}</span>}
            </dd>
          </div>
        </dl>
        <div className="plan-box">
          <GroynePlan
            normal={effectiveNormal(spot)}
            wdir={r.wdir}
            wspd={r.wspd}
            swdir={r.swdir}
            side={block.side}
          />
          <div className="plan-cap">{leeCaption(spot, block)}</div>
        </div>
      </div>
    </section>
  );
}

interface Props {
  initialSpotId: string | null; // spottet ugen åbner på (efter et tjek på kortet)
  onCheckOnMap: (spotId: string) => void; // App skifter til kortet med spottet
  onOpenMap: (spotId: string, time: string) => void; // dobbelttryk: kortet på spot og tid
}

export function NowScreen({ initialSpotId, onCheckOnMap, onOpenMap }: Props) {
  const { forecast, status, error } = useForecast();
  const { obs, status: obsStatus } = useObs();
  const [spotId, setSpotId] = useState<string | null>(initialSpotId);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<HorizonDays>(() => loadHorizonDays());
  const [showFront, setShowFront] = useState<boolean>(() => loadSurfHeightOn());
  const detailRef = useRef<HTMLDivElement>(null);

  // Én rangering til kortene og listen (lib/blocks.ts), inden for horisonten.
  const ranking = useMemo(
    () => (forecast ? rankSpots(forecast, SPOTS, nowLocalIso(), horizon) : []),
    [forecast, horizon]
  );
  const verdict = ranking[0] ?? null;

  // Timescorer pr. spot til kortenes grafer.
  const perSpot = useMemo(() => {
    const m = new Map<string, Map<string, Block>>();
    if (forecast) for (const s of SPOTS) m.set(s.id, hourlyBlocks(forecast, s));
    return m;
  }, [forecast]);

  // Ugen starter på dommens spot, medmindre du selv har valgt et andet.
  const spot = SPOTS.find((s) => s.id === (spotId ?? verdict?.spot.id)) ?? SPOTS[0];

  const days = useMemo(() => (forecast ? buildDays(forecast, spot) : []), [forecast, spot]);

  // Valgt blok: den du trykkede på; ellers dommens blok, hvis ugen viser
  // dommens spot; ellers første kommende blok.
  const selected: Block | null = useMemo(() => {
    const all = days.flatMap((d) => d.blocks).filter((b): b is Block => b !== null);
    if (selectedTime) {
      const hit = all.find((b) => b.time === selectedTime);
      if (hit) return hit;
    }
    if (verdict && verdict.spot.id === spot.id) {
      const hit = all.find((b) => b.time === verdict.block.time);
      if (hit) return hit;
    }
    const now = nowLocalIso();
    return all.find((b) => b.time >= now) ?? all[all.length - 1] ?? null;
  }, [days, selectedTime, verdict, spot]);

  const today = todayIso();
  const st = sunTimes(today, SPOTS[0].lat, SPOTS[0].lon);
  const sun = typeof st === "object" ? `sol ${fmtSunHour(st.sunrise)}–${fmtSunHour(st.sunset)}` : null;

  const headerRight = forecast ? (
    status === "cached" ? (
      <>
        <strong>Offline</strong> · viser forecast fra {fmtFetched(forecast.fetchedAt)}
      </>
    ) : (
      <>hentet {fmtFetched(forecast.fetchedAt)}</>
    )
  ) : status === "henter" ? (
    "Henter forecast …"
  ) : null;

  if (!forecast) {
    return (
      <div className="screen">
        <ScreenHeader right={headerRight} help={<NuHelp />} />
        {status === "fejl" && (
          <div className="errorbox">
            <strong>Ingen forecast.</strong>
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  const holes = forecast.areas[spot.area]?.holes.length ?? 0;

  return (
    <div className="screen">
      <ScreenHeader right={headerRight} help={<NuHelp />} />

      {forecast.areas[spot.area]?.dry && (
        <div className="errorbox">
          <strong>Ingen bølgedata for dette område.</strong>
          <p>
            Bølgepunktet for {spot.shortName}s vejr-område ramte land. Ret AREAS i
            src/config/spots.ts til en våd celle.
          </p>
        </div>
      )}

      <SpotCards
        entries={ranking}
        perSpot={perSpot}
        now={nowLocalIso().slice(0, 13) + ":00"}
        dates={horizonDates(nowLocalIso(), horizon)}
        horizon={horizon}
        onHorizon={(d) => {
          setHorizon(d);
          saveHorizonDays(d);
        }}
        selectedId={spot.id}
        onSelect={(id, time) => {
          setSpotId(id);
          setSelectedTime(time);
        }}
        onOpenMap={onOpenMap}
        sun={sun}
        showFront={showFront}
      />

      <QuickPick
        entries={ranking}
        selectedId={spot.id}
        onSelect={(id, time) => {
          setSpotId(id);
          setSelectedTime(time);
        }}
        onOpenMap={onOpenMap}
      />

      <MeasuredNow obs={obs} status={obsStatus} forecast={forecast} />

      <div className="sec-h">
        <span>Ugen for {spot.shortName}</span>
      </div>
      <SpotChips value={spot.id} onChange={setSpotId} />

      {spot.warning && <div className="warnbox">⚠ {spot.warning}</div>}
      <SpotCheck spot={spot} onCheck={() => onCheckOnMap(spot.id)} />

      <Barograph
        days={days}
        selected={selected?.time ?? null}
        onSelect={(b) => {
          setSelectedTime(b.time);
          // tallene står under skærmkanten på en telefon — rul dem frem
          setTimeout(
            () => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
            60
          );
        }}
      />

      {selected && (
        <div ref={detailRef}>
          <BlockDetail block={selected} spot={spot} obs={obs} showFront={showFront} />
        </div>
      )}

      <p className="hint">
        Stryg i søjlerne for hele ugen · tryk på en søjle for tallene
        {holes > 0 && ` · ${holes} timer mangler i kilden`}
      </p>

      <section className="card">
        <div className="card-h">
          <span>Indstillinger</span>
        </div>
        <label className="setting-toggle">
          <input
            type="checkbox"
            checked={showFront}
            onChange={(e) => {
              saveSurfHeightOn(e.target.checked);
              setShowFront(e.target.checked);
            }}
          />
          <span>
            <strong>Vis bølgens front i meter</strong>
            <span className="cal-status">
              {showFront
                ? "højden på revlen, regnet af bølgehøjde og periode, står ved tallene på dommen, i detaljen og på kortet"
                : "slået fra, appen viser kun havets bølgehøjde"}
            </span>
          </span>
        </label>
      </section>
    </div>
  );
}
