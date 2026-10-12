// NU: dommen øverst som swipebare spot-kort (bedste først, med scoren
// time for time), rangeringen af alle spots, og ugen for det valgte spot
// (chips → barograf → tal + høfde-planview). Horisonten (2 døgn / 7 dage)
// vælges på kortene og huskes. Forklaringerne bor bag ?-knappen i toppen.

import { useMemo, useRef, useState } from "react";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, effectiveNormal, checkedOnMapAt, isOverridden, type Spot } from "../config/spots";
import {
  buildDays,
  rankSpots,
  hourlyBlocks,
  horizonDates,
  leeCaption,
  nowLocalIso,
  type Block,
  type HorizonDays
} from "../lib/blocks";
import { loadHorizonDays, saveHorizonDays } from "../lib/settings";
import { scoreColor } from "../lib/colors";
import { fmtClock, fmtDayLabel, todayIso } from "../lib/time";
import { fmt, compass } from "../lib/format";
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
          <strong>Swipe kortet</strong> til siden for det næste spot i rækkefølgen — ugen
          nedenunder følger med. <strong>Grafen</strong> på kortet er spottets score time for
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
          <strong>Bølge</strong> er bølgehøjden i meter. "Ren dønning" under tallet betyder, at
          vejrtjenesten har skilt dønningen fra den sø, vinden pisker op lige nu, og tallet er
          dønningen alene. "Samlet sø" betyder, at den ikke kunne skille dem ad, og tallet er det
          hele.
        </p>
        <p>
          <strong>Periode</strong> er sekunder mellem bølgerne. Høj periode (8+) = kraft og
          orden. Lav (4–5) = tætpakket plaskeri.
        </p>
        <p>
          <strong>Bølgeretning</strong> og <strong>vind</strong> er der, hvor bølge og vind kommer{" "}
          <em>fra</em>. <strong>Stød</strong> er vindstødene. Over 14 m/s trækker de fra i
          scoren.
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

function BlockDetail({ block, spot }: { block: Block; spot: Spot }) {
  const r = block.row;
  const color = scoreColor(block.score);
  const cal = correctionFor(spot.id);
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
      <div className="detail-body">
        <div className="swell-block">
          <div className="swell-line">
            <SwellChip tp={r.tp} big />
            <span className="swell-tp">{fmt(r.tp)} s</span>
          </div>
          <SwellGauge tp={r.tp} />
        </div>
        <dl className="detail-grid">
          <div>
            <dt>Bølge</dt>
            <dd>
              {fmt(r.hs)} m
              <span className="dd-note">{r.source === "swell" ? "ren dønning" : "samlet sø"}</span>
            </dd>
          </div>
          <div>
            <dt>Periode</dt>
            <dd>{fmt(r.tp)} s</dd>
          </div>
          <div>
            <dt>Bølgeretning</dt>
            <dd>
              {compass(r.swdir)} {Math.round(r.swdir)}°
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
}

export function NowScreen({ initialSpotId, onCheckOnMap }: Props) {
  const { forecast, status, error } = useForecast();
  const [spotId, setSpotId] = useState<string | null>(initialSpotId);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<HorizonDays>(() => loadHorizonDays());
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
        sun={sun}
      />

      <QuickPick
        entries={ranking}
        selectedId={spot.id}
        onSelect={(id, time) => {
          setSpotId(id);
          setSelectedTime(time);
        }}
      />

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
          <BlockDetail block={selected} spot={spot} />
        </div>
      )}

      <p className="hint">
        Stryg i søjlerne for hele ugen · tryk på en søjle for tallene
        {holes > 0 && ` · ${holes} timer mangler i kilden`}
      </p>
    </div>
  );
}
