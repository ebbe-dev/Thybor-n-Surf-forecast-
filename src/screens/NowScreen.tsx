// NU: dommen øverst som helte-kort, rangeringen af alle spots, og ugen
// for det valgte spot (chips → barograf → tal + høfde-planview).
// Forklaringerne bor bag ?-knappen i toppen.

import { useMemo, useRef, useState } from "react";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, effectiveNormal, setNormal, type Spot } from "../config/spots";
import { buildDays, rankSpots, nowLocalIso, type Block } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { fmtClock, fmtDayLabel, todayIso } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { sunTimes, fmtSunHour } from "../lib/sun";
import { Verdict } from "../components/Verdict";
import { Barograph } from "../components/Barograph";
import { GroynePlan } from "../components/GroynePlan";
import { Info, Legend } from "../components/Info";
import { QuickPick } from "../components/QuickPick";
import { ScreenHeader } from "../components/ScreenHeader";
import { SpotChips } from "../components/SpotChips";
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
          hvilken mole.</strong> Den finder det bedste 3-timers tidsrum i dagslys i dag og i morgen
          på tværs af alle spots. Det er listens øverste række, med side og tal. Vil du længere
          frem i ugen, er det søjlerne nedenfor.
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
          Et tomt felt med stiplet kant betyder, at vejrtjenesten mangler data for de timer. Det
          er et hul, ikke fladt hav. <strong>Tryk på en søjle</strong> for tallene bag og en
          tegning af høfden med vindretning og læside.
        </p>
      </Info>
      <Info q="Hvad betyder tallene og tegningen?">
        <p>
          <strong>Bølge</strong> er bølgehøjden i meter. Mærket{" "}
          <span className="src-badge swell">swell</span> betyder ren dønning (organiserede
          bølger, det bedste); <span className="src-badge vindsø">vindsø</span> betyder, at
          tallet er den samlede, mere rodede sø, som vinden pisker op. Der var ingen ren dønning
          at måle.
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
          <strong>Tegningen</strong> er en høfde set fra oven (nord er op). Den lange streg er
          selve høfden, det skraverede felt er læsiden, der hvor du går i, og pilen viser vinden.
        </p>
      </Info>
    </>
  );
}

// Kystnormalen kan rettes for de spots, hvor retningen er et gæt. Fylder
// én linje, til du trykker Ret.
function NormalSetting({ spot, onChange }: { spot: Spot; onChange: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(effectiveNormal(spot)));
  const current = effectiveNormal(spot);
  return (
    <div className="card normal-setting">
      <div className="normal-line">
        <span>
          Spottet vender mod <strong>{compass(current)} {current}°</strong>
          {!editing && <span className="muted"> · et gæt, ret det hvis du kan se andet</span>}
        </span>
        {!editing && (
          <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Ret
          </button>
        )}
      </div>
      {editing && (
        <>
          <label htmlFor="normal-input" className="muted">
            Grader: 0 = nord, 90 = øst, 180 = syd, 270 = vest. Scoren regner med det samme med
            den nye retning.
          </label>
          <div className="normal-row">
            <input
              id="normal-input"
              type="number"
              inputMode="numeric"
              min={0}
              max={359}
              value={val}
              onChange={(e) => setVal(e.target.value)}
            />
            <button
              className="btn"
              onClick={() => {
                const n = Number(val);
                if (Number.isFinite(n)) {
                  setNormal(spot, n);
                  setEditing(false);
                  onChange();
                }
              }}
            >
              Gem
            </button>
            <button className="btn-ghost" onClick={() => setEditing(false)}>
              Annullér
            </button>
          </div>
        </>
      )}
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
        <dl className="detail-grid">
          <div>
            <dt>Bølge</dt>
            <dd>
              {fmt(r.hs)} m<span className={"src-badge " + r.source}>{r.source}</span>
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
            side={block.side}
            compact
          />
          <div className="plan-cap">
            {spot.fixedSide ? "surfes på" : "læ på"} {block.side}siden
          </div>
        </div>
      </div>
    </section>
  );
}

export function NowScreen() {
  const { forecast, status, error } = useForecast();
  const [spotId, setSpotId] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [normalVersion, setNormalVersion] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  // Én rangering til både dommen og listen (lib/blocks.ts).
  const ranking = useMemo(
    () => (forecast ? rankSpots(forecast, SPOTS) : []),
    [forecast, normalVersion]
  );
  const verdict = ranking[0] ?? null;

  // Ugen starter på dommens spot, medmindre du selv har valgt et andet.
  const spot = SPOTS.find((s) => s.id === (spotId ?? verdict?.spot.id)) ?? SPOTS[0];

  const days = useMemo(
    () => (forecast ? buildDays(forecast, spot) : []),
    [forecast, spot, normalVersion]
  );

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

      <Verdict pick={verdict} sun={sun} />

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
      {spot.adjustableNormal && (
        <NormalSetting
          key={spot.id}
          spot={spot}
          onChange={() => setNormalVersion((v) => v + 1)}
        />
      )}

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
