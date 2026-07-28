// NU: dommen øverst, 7-døgns barograf i 3-timers blokke, tryk på en
// søjle → tal + høfde-planview der roterer med vinden.

import { useMemo, useState } from "react";
import { useForecast } from "../hooks/useForecast";
import { SPOTS, effectiveNormal, setNormal, type Spot } from "../config/spots";
import { buildDays, pickVerdict, nowLocalIso, type Block } from "../lib/blocks";
import { scoreColor } from "../lib/colors";
import { dayName, fmtClock } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { Verdict } from "../components/Verdict";
import { Barograph } from "../components/Barograph";
import { GroynePlan } from "../components/GroynePlan";
import { Info, Legend } from "../components/Info";

function fmtFetched(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function NormalSetting({ spot, onChange }: { spot: Spot; onChange: () => void }) {
  const [val, setVal] = useState(String(effectiveNormal(spot)));
  return (
    <div className="normal-setting">
      <label htmlFor="normal-input">
        Hvilken retning vender spottet imod? (0 = nord, 90 = øst, 180 = syd, 270 = vest).
        Tallet er et <strong>gæt</strong> — står du derude og kan se det vender anderledes,
        så ret det her og tryk Gem. Scoren regner med det samme med den nye retning.
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
              onChange();
            }
          }}
        >
          Gem
        </button>
      </div>
    </div>
  );
}

function BlockDetail({ block, spot }: { block: Block; spot: Spot }) {
  const r = block.row;
  const color = scoreColor(block.score);
  return (
    <section className="detail">
      <header className="detail-head">
        <span>
          {dayName(block.time)} kl. {fmtClock(block.time)} · {spot.shortName}
        </span>
        <span className="detail-score" style={{ color }}>
          {fmt(block.score)}
        </span>
      </header>
      <dl className="detail-grid">
        <div>
          <dt>Bølge</dt>
          <dd>
            {fmt(r.hs)} m <span className={"src-badge " + r.source}>{r.source}</span>
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
      <GroynePlan
        normal={effectiveNormal(spot)}
        wdir={r.wdir}
        wspd={r.wspd}
        side={block.side}
      />
    </section>
  );
}

export function NowScreen() {
  const { forecast, status, error } = useForecast();
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [normalVersion, setNormalVersion] = useState(0);

  const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];

  const days = useMemo(
    () => (forecast ? buildDays(forecast, spot) : []),
    [forecast, spot, normalVersion]
  );
  const verdict = useMemo(
    () => (forecast ? pickVerdict(forecast, SPOTS) : null),
    [forecast, normalVersion]
  );

  // Default-valg: første kommende blok for det valgte spot.
  const selected: Block | null = useMemo(() => {
    const all = days.flatMap((d) => d.blocks).filter((b): b is Block => b !== null);
    if (selectedTime) {
      const hit = all.find((b) => b.time === selectedTime);
      if (hit) return hit;
    }
    const now = nowLocalIso();
    return all.find((b) => b.time >= now) ?? all[all.length - 1] ?? null;
  }, [days, selectedTime]);

  if (!forecast) {
    return (
      <div className="screen">
        <p className="statusline">{status === "henter" ? "Henter forecast …" : ""}</p>
        {status === "fejl" && (
          <div className="errorbox">
            <strong>Ingen forecast.</strong>
            <p>{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <p className="statusline">
        {status === "cached" ? (
          <strong>OFFLINE — viser forecast hentet {fmtFetched(forecast.fetchedAt)}</strong>
        ) : (
          <>hentet {fmtFetched(forecast.fetchedAt)}</>
        )}
        {forecast.holes.length > 0 && (
          <span className="muted"> · {forecast.holes.length} timer mangler i kilden</span>
        )}
      </p>

      <Verdict pick={verdict} />

      <Info q="Hvad betyder dommen?">
        <p>
          Dommen er appens svar på hovedspørgsmålet: <strong>hvornår skal du køre derud, og til
          hvilken mole.</strong> Den finder det bedste 3-timers tidsrum i de næste 7 døgn på tværs
          af alle spots.
        </p>
        <p>
          <strong>"Læ på nordsiden"</strong> betyder: gå i vandet på nordsiden af høfden — det er
          den side, vinden ikke roder op, så vandet er glattest der.
        </p>
        <p>Scoren går fra 0 til 10, og farverne betyder det samme i hele appen:</p>
        <Legend />
        <p>
          Spots mærket <strong>UKALIBRERET</strong> regner med en retning, vi endnu ikke har
          efterprøvet i virkeligheden — tag deres tal med et gran salt.
        </p>
      </Info>

      <div className="spot-tabs">
        {SPOTS.map((s) => (
          <button
            key={s.id}
            className={"spot-tab" + (s.id === spotId ? " active" : "")}
            onClick={() => setSpotId(s.id)}
          >
            {s.shortName}
            {s.uncalibrated && <span className="uncal">ukalibreret</span>}
          </button>
        ))}
      </div>

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
        onSelect={(b) => setSelectedTime(b.time)}
      />

      <Info q="Sådan læser du søjlerne">
        <p>
          Hver søjle er et 3-timers tidsrum (kl. 05, 08, 11, 14, 17 og 20), og der er 7 dage —
          <strong> stryg til siden</strong> for at se længere frem. Jo højere og "varmere" søjlen
          er, jo bedre forhold for det valgte spot.
        </p>
        <p>
          <strong>Pilen over søjlen</strong> viser, hvor vinden blæser <em>hen</em> (op = mod
          nord). Peger pilen ud mod havet, er det offshore — det glatter bølgerne. Peger den ind
          mod land, roder den dem sammen.
        </p>
        <p>
          Nedtonede søjler er allerede passeret i dag. Et tomt felt med stiplet kant betyder, at
          vejrtjenesten mangler data for de timer — det er et hul, ikke fladt hav.
        </p>
        <p>
          <strong>Tryk på en søjle</strong> for at se tallene bag og en tegning af høfden med
          vindretning og læside.
        </p>
      </Info>

      {selected && <BlockDetail block={selected} spot={spot} />}

      {selected && (
        <Info q="Hvad betyder tallene og tegningen?">
          <p>
            <strong>Bølge</strong> er bølgehøjden i meter. Mærket{" "}
            <span className="src-badge swell">swell</span> betyder ren dønning (organiserede
            bølger, det bedste);{" "}
            <span className="src-badge vindsø">vindsø</span> betyder, at tallet er den samlede,
            mere rodede sø, som vinden pisker op — der var ingen ren dønning at måle.
          </p>
          <p>
            <strong>Periode</strong> er sekunder mellem bølgerne. Høj periode (8+) = kraft og
            orden. Lav (4–5) = tætpakket plaskeri.
          </p>
          <p>
            <strong>Bølgeretning</strong> og <strong>vind</strong> er der, hvor bølge og vind
            kommer <em>fra</em>. <strong>Stød</strong> er vindstødene — over 14 m/s trækker de
            fra i scoren.
          </p>
          <p>
            <strong>Tegningen</strong> er en høfde set fra oven (nord er op). Den lange streg er
            selve høfden, det skraverede felt er læsiden — der, hvor du går i — og pilen viser
            vinden.
          </p>
        </Info>
      )}
    </div>
  );
}
