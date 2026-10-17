// Ground swell / wind swell (src/lib/swell.ts), ground swell under
// vindsøen, våddragten (src/lib/water.ts), og at ekstra-kaldets dele når
// rækken (api/openMeteo.ts).
import { swellKind, displayedPeriod, groundSwellUnder, UNDER_MIN_HS } from "../../src/lib/swell";
import { wetsuitHint } from "../../src/lib/water";
import { fmtSurfRange } from "../../src/lib/surfHeight";
import { mergeHourly, type MarineHourly, type WindHourly, type MarineExtraHourly } from "../../src/api/openMeteo";
import { check, done } from "./lib.mts";

console.log("mærket");
check("7,96 s vises som 8,0 og er ground swell", displayedPeriod(7.96) === 8 && swellKind(7.96) === "ground");
check("7,94 s er wind swell", swellKind(7.94) === "wind");

console.log("ground swell under vindsøen");
const wind = { tp: 5.5, swell: { hs: 0.6, tp: 14, dir: 310 }, swell2: null };
check("lang dønning 0,6 m under vindsøen findes", groundSwellUnder(wind)?.tp === 14);
check("for lille dønning tæller ikke", groundSwellUnder({ tp: 5.5, swell: { hs: UNDER_MIN_HS - 0.05, tp: 14, dir: 310 }, swell2: null }) === null);
check("kort dønning tæller ikke", groundSwellUnder({ tp: 5.5, swell: { hs: 0.9, tp: 6, dir: 310 }, swell2: null }) === null);
check("2. dønning kan bære det", groundSwellUnder({ tp: 6, swell: { hs: 1.1, tp: 6, dir: 190 }, swell2: { hs: 0.5, tp: 9, dir: 300 } })?.dir === 300);
check("den største af to lange vinder", groundSwellUnder({ tp: 5, swell: { hs: 0.4, tp: 9, dir: 300 }, swell2: { hs: 0.7, tp: 10, dir: 280 } })?.hs === 0.7);
check("rækken selv ground swell → intet 'under'", groundSwellUnder({ tp: 9, swell: { hs: 1, tp: 9, dir: 300 }, swell2: null }) === null);
check("ingen dele → null", groundSwellUnder({ tp: 5, swell: null }) === null);

console.log("våddragten");
check("21 °C: 3/2 eller shorty", wetsuitHint(21) === "3/2 eller shorty");
check("15 °C: 3/2 eller 4/3", wetsuitHint(15) === "3/2 eller 4/3");
check("13,6 °C: 4/3 + støvler", wetsuitHint(13.6) === "4/3 + støvler");
check("9 °C: 5/4 + hætte, støvler og handsker", wetsuitHint(9) === "5/4 + hætte, støvler og handsker");
check("4 °C: 6/5", wetsuitHint(4).startsWith("6/5"));
check("grænsen 11 hører til 4/3", wetsuitHint(11) === "4/3 + støvler" && wetsuitHint(10.9).startsWith("5/4"));

console.log("spænd med enheden én gang");
check("1,3–2,0 m", fmtSurfRange(1.3, 2.0) === "1,3–2,0 m", fmtSurfRange(1.3, 2.0));
check("85 cm–1,2 m", fmtSurfRange(0.85, 1.2) === "85 cm–1,2 m", fmtSurfRange(0.85, 1.2));
check("60–85 cm", fmtSurfRange(0.6, 0.85) === "60–85 cm", fmtSurfRange(0.6, 0.85));

console.log("ekstra-kaldet når rækken");
const m: MarineHourly = {
  time: ["2026-10-17T12:00"],
  wave_height: [1.5],
  wave_direction: [300],
  wave_period: [7],
  swell_wave_height: [0.6],
  swell_wave_period: [10],
  swell_wave_direction: [310],
  swell_wave_peak_period: [14]
};
const w: WindHourly = { time: ["2026-10-17T12:00"], wind_speed_10m: [4], wind_direction_10m: [110], wind_gusts_10m: [6], temperature_2m: [11] };
const x: MarineExtraHourly = {
  time: ["2026-10-17T12:00"],
  wind_wave_height: [1.3],
  wind_wave_period: [4.4],
  wind_wave_direction: [110],
  wind_wave_peak_period: [5.6],
  sea_level_height_msl: [-0.4],
  secondary_swell_wave_height: [0.4],
  secondary_swell_wave_period: [5.7],
  secondary_swell_wave_direction: [270],
  sea_surface_temperature: [14.3]
};
const r = mergeHourly(m, w, x).rows[0];
check("2. dønning på rækken", r.swell2?.hs === 0.4 && r.swell2?.tp === 5.7 && r.swell2?.dir === 270);
check("vandtemperatur på rækken", r.sst === 14.3);
check("vindsøen bestemmer perioden (1,3² ≥ halvdelen af 1,5²): 5,6 s", r.tp === 5.6);
check("den lange dønning 0,6 m / 14 s ligger under", groundSwellUnder(r)?.tp === 14);
const zero: MarineExtraHourly = { ...x, secondary_swell_wave_height: [0], secondary_swell_wave_period: [0], secondary_swell_wave_direction: [0] };
check("NOAA's nuller er ingen 2. dønning", mergeHourly(m, w, zero).rows[0].swell2 === null);
check("uden ekstra-kald: null", mergeHourly(m, w).rows[0].swell2 === null && mergeHourly(m, w).rows[0].sst === null);

done("swell");
