// Dommen som swipebare spot-kort: det bedste spot forrest, de næste i
// rangeringens rækkefølge bagved — det næste kort titter frem i kanten.
// Hvert kort er helte-kortet (dommens ord, spot, hvornår, tal, score) plus
// scoren time for time frem til horisonten (ScoreSparkline). Et swipe
// vælger spottet i ugeoversigten nedenunder, og et tryk i listen ruller
// kortene hen til spottet. Horisonten (2 døgn / 7 dage) vælges i øjen-
// brynet og gælder dom, liste og grafer på én gang. Kanten bærer scorens
// farve — stadig det eneste sted i appen, hvor en kant gør det.

import { useEffect, useRef, type CSSProperties } from "react";
import { HORIZON_OPTIONS, leeCaption, type Block, type HorizonDays, type VerdictPick } from "../lib/blocks";
import { scoreColor, scoreLabel } from "../lib/colors";
import { fmtClock, relativeDayLabel } from "../lib/time";
import { fmt, compass } from "../lib/format";
import { ScoreSparkline } from "./ScoreSparkline";
import { SwellChip } from "./SwellChip";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const GAP = 10; // afstand mellem kortene — skal matche .spot-cards i styles.css
const SETTLE_MS = 120; // et swipe meldes først, når rullet er faldet til ro
const TRAVEL_MS = 1500; // så længe kan et rul sat i gang af listen højst vare

interface Props {
  entries: VerdictPick[]; // rangeringen, bedste først
  perSpot: Map<string, Map<string, Block>>; // timescorer pr. spot
  now: string; // ISO, hel time — grafernes venstre kant
  dates: string[]; // horisontens dage
  horizon: HorizonDays;
  onHorizon: (days: HorizonDays) => void;
  selectedId: string;
  onSelect: (spotId: string, time: string) => void;
  sun: string | null;
}

function HorizonToggle({ value, onChange }: { value: HorizonDays; onChange: (d: HorizonDays) => void }) {
  return (
    <span className="hz" role="group" aria-label="horisont">
      {HORIZON_OPTIONS.map((d) => (
        <button
          key={d}
          className={"hz-btn" + (d === value ? " on" : "")}
          onClick={() => onChange(d)}
          aria-pressed={d === value}
        >
          {d === 2 ? "2 døgn" : `${d} dage`}
        </button>
      ))}
    </span>
  );
}

export function SpotCards({
  entries,
  perSpot,
  now,
  dates,
  horizon,
  onHorizon,
  selectedId,
  onSelect,
  sun
}: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const settleRef = useRef<number | null>(null);
  // Et rul sat i gang af listen/chips er på vej til ét bestemt kort; de
  // kort, det passerer undervejs, må ikke meldes som swipes.
  const travelRef = useRef<{ target: number; until: number } | null>(null);
  const activeIdx = Math.max(
    0,
    entries.findIndex((e) => e.spot.id === selectedId)
  );

  // Ét korts skridt i pixels (kort + mellemrum).
  const step = () => {
    const card = scroller.current?.firstElementChild as HTMLElement | null;
    return card ? card.offsetWidth + GAP : 0;
  };
  const indexAtScroll = () => {
    const el = scroller.current;
    const s = step();
    if (!el || s === 0) return 0;
    return Math.max(0, Math.min(entries.length - 1, Math.round(el.scrollLeft / s)));
  };

  // Valg udefra (listen, chips, ny rækkefølge): rul hen til kortet, hvis
  // det ikke allerede står der. Første gang (fx tilbage fra kortet med et
  // valgt spot) står kortene der med det samme; siden rulles der blødt.
  const placedRef = useRef(false);
  useEffect(() => {
    const el = scroller.current;
    if (!el || entries.length === 0) return;
    const first = !placedRef.current;
    placedRef.current = true;
    if (indexAtScroll() === activeIdx) return;
    if (first) {
      el.scrollTo({ left: activeIdx * step(), behavior: "instant" });
      return;
    }
    travelRef.current = { target: activeIdx, until: Date.now() + TRAVEL_MS };
    el.scrollTo({ left: activeIdx * step(), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, activeIdx, entries]);

  // Swipe: når rullet er faldet til ro, er kortet i midten det valgte spot.
  const onScroll = () => {
    if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      settleRef.current = null;
      const i = indexAtScroll();
      const travel = travelRef.current;
      if (travel) {
        if (i === travel.target || Date.now() > travel.until) travelRef.current = null;
        else return; // stadig på vej til det kort, listen valgte
      }
      const e = entries[i];
      if (e && e.spot.id !== selectedId) onSelect(e.spot.id, e.block.time);
    }, SETTLE_MS);
  };
  // Rører brugeren skærmen, er det brugerens rul fra nu af.
  const onPointerDown = () => {
    travelRef.current = null;
  };
  useEffect(
    () => () => {
      if (settleRef.current !== null) window.clearTimeout(settleRef.current);
    },
    []
  );

  const eyebrow = (
    <div className="eyebrow">
      <span className="dot" />
      Næste
      <HorizonToggle value={horizon} onChange={onHorizon} />
      {sun && <span className="eyebrow-sun">{sun}</span>}
    </div>
  );

  if (entries.length === 0) {
    return (
      <section className="hero">
        {eyebrow}
        <h1 className="hero-label muted">Ingen kommende blokke i data</h1>
      </section>
    );
  }

  return (
    <div className="spot-cards-wrap">
      <div
        className={"spot-cards" + (entries.length === 1 ? " single" : "")}
        ref={scroller}
        onScroll={onScroll}
        onPointerDown={onPointerDown}
        aria-label="spots efter bedste vindue — swipe for det næste"
      >
        {entries.map(({ spot, block }, i) => {
          const r = block.row;
          const color = scoreColor(block.score);
          const hourly = perSpot.get(spot.id);
          return (
            <section
              className="hero"
              key={spot.id}
              style={{ "--band": color } as CSSProperties}
              aria-label={`${i + 1} af ${entries.length}: ${spot.shortName}`}
            >
              {eyebrow}
              <div className="hero-row">
                <div className="hero-main">
                  <h1 className="hero-label" style={{ color }}>
                    {scoreLabel(block.score)}
                  </h1>
                  <div className="hero-spot">
                    {spot.shortName}
                    {spot.uncalibrated && <span className="uncal-inline"> · ukalibreret</span>}
                  </div>
                  <div className="hero-when">
                    <strong>
                      {cap(relativeDayLabel(block.time))} kl. {fmtClock(block.time)}
                    </strong>
                    {" · "}
                    {leeCaption(spot, block)}
                  </div>
                  <div className="hero-sub">
                    <SwellChip tp={r.tp} />{" "}
                    <span className="nw">
                      {fmt(r.hs)} m / {fmt(r.tp)} s
                    </span>
                    {" · "}
                    <span className="nw">
                      vind {compass(r.wdir)} {fmt(r.wspd, 0)} m/s
                    </span>
                  </div>
                </div>
                <div className="hero-score">
                  <div className="n" style={{ color }}>
                    {fmt(block.score)}
                  </div>
                  <div className="d">af 10</div>
                </div>
              </div>
              {hourly && (
                <ScoreSparkline blocks={hourly} from={now} dates={dates} pick={block} spot={spot} />
              )}
            </section>
          );
        })}
      </div>
      {entries.length > 1 && (
        <div className="cdots" aria-hidden="true">
          {entries.map((e, i) => (
            <span
              key={e.spot.id}
              className={"cdot" + (i === activeIdx ? " on" : "")}
              style={i === activeIdx ? { background: scoreColor(e.block.score) } : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
