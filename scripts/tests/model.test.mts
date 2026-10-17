// Modellen (src/model/model.ts) mod reglerne i docs/surf-science.md og
// sessionens referencedage. Ændrer du en konstant, skal tallene her følge
// med — og forklares faktor for faktor.
import {
  scoreSpot,
  caveats,
  obliqueFactor,
  levelFactor,
  offshoreStrength,
  onshoreBlowout,
  reflectionFactor,
  leeSide,
  windQuality,
  type Row
} from "../../src/model/model";
import { SPOTS, spotOpts } from "../../src/config/spots";
import { computeStats } from "../../src/lib/history";
import { check, near, done, fakeLocalStorage } from "./lib.mts";

fakeLocalStorage();

const spot = (id: string) => {
  const s = SPOTS.find((x) => x.id === id);
  if (!s) throw new Error("ukendt spot " + id);
  return s;
};
const row = (p: Partial<Row>): Row => ({
  time: "2026-10-17T12:00",
  hs: 1,
  tp: 6,
  swdir: 290,
  swell: null,
  windSea: null,
  level: null,
  wdir: 100,
  wspd: 3,
  gust: 5,
  temp: 10,
  ...p
});
const score = (id: string, p: Partial<Row>) => {
  const s = spot(id);
  return scoreSpot(row(p), s.shoreNormal, spotOpts(s));
};

console.log("faktorerne");
check("skrå: 0° → 1", near(obliqueFactor(0), 1, 1e-9));
check("skrå: 45° → 0,88", near(obliqueFactor(45), 0.88, 0.01));
check("skrå: 90° → 0,53", near(obliqueFactor(90), 0.53, 0.01));
check("skrå: 140° → 0", obliqueFactor(140) === 0);
check("vandstand +0,4 → 1", levelFactor(0.4) === 1);
check("vandstand +1,0 → 0,6", near(levelFactor(1.0), 0.6, 1e-9));
check("vandstand −1,2 → 0,85", near(levelFactor(-1.2), 0.85, 1e-9));
check("vandstand ukendt → 1", levelFactor(null) === 1);
check("mole 1,0 m → 1", reflectionFactor(1.0) === 1);
check("mole 2,0 m → 0,5", near(reflectionFactor(2.0), 0.5, 1e-9));
check("fraland 5 m/s → 0", offshoreStrength(95, 5, 95) === 0);
check("fraland 12 m/s → 1", near(offshoreStrength(95, 12, 95), 1, 1e-9));
check("påland 14 m/s lige på → 1", near(onshoreBlowout(275, 14, 275), 1, 1e-9));
check("påland 14 m/s som sidevind → 0", near(onshoreBlowout(185, 14, 275), 0, 1e-9));
check("ren fraland 4 m/s → vind 1,00", near(windQuality(95, 4, 275), 1, 1e-9));
check("ren fraland 8,5 m/s → vind 0,70", near(windQuality(95, 8.5, 275), 0.7, 0.01));
check("ren fraland 12 m/s → vind 0,40", near(windQuality(95, 12, 275), 0.4, 0.01));

console.log("referencedagene");
const s267 = score("sneglehuset", { hs: 1.3, tp: 6.7, swdir: 315, wdir: 270, wspd: 2.6, gust: 4 });
check("26/7 Sneglehuset (ankeret): over 8,5", s267 >= 8.5, s267.toFixed(2));
const s1310 = score("vestkysten", { hs: 1.5, tp: 6, swdir: 180, wdir: 200, wspd: 10, gust: 13 });
check("13/10 Langerhuse H: sydbølge i sydvind over 5,5", s1310 >= 5.5, s1310.toFixed(2));
check("13/10: læ på nordsiden", leeSide(200, 275) === "nord");
const s1410 = score("hoefde-q", { hs: 2.0, tp: 6.5, swdir: 275, wdir: 270, wspd: 12, gust: 10 });
check("14/10 Q: vestenvind 12 m/s blæst ud ≈ 1,7", near(s1410, 1.66, 0.1), s1410.toFixed(2));
const c1410 = caveats(row({ hs: 2, tp: 6.5, swdir: 275, wdir: 270, wspd: 12 }), 270, spotOpts(spot("hoefde-q")));
check("14/10: advarsel hård pålandsvind", c1410.some((c) => c.key === "onshore-hard"));
const r1110 = row({ hs: 2.0, tp: 7, swdir: 320, wdir: 140, wspd: 10, gust: 12 });
const s1110 = scoreSpot(r1110, 320, spotOpts(spot("indsejlingen")));
check("11/10 Indsejlingen: hård fraland og mole, under 5", s1110 < 5, s1110.toFixed(2));
const c1110 = caveats(r1110, 320, spotOpts(spot("indsejlingen"))).map((c) => c.key);
check("11/10: advarsler hård fraland + mole", c1110.includes("offshore-hard") && c1110.includes("reflection"), c1110.join(","));

console.log("advarsel ⇔ fradrag");
check("ren dag: ingen advarsler", caveats(row({ hs: 1.2, tp: 8, swdir: 290, wdir: 100, wspd: 4 }), 275, spotOpts(spot("vestkysten"))).length === 0);
check("høj vandstand advarer", caveats(row({ level: 0.6 }), 275).some((c) => c.key === "level-high"));
check("lav vandstand advarer", caveats(row({ level: -0.8 }), 275).some((c) => c.key === "level-low"));
check("mole advarer først over 1,2 m", !caveats(row({ hs: 1.1 }), 320, { reflective: true }).some((c) => c.key === "reflection"));

console.log("HISTORIK regner som NU (rettet 17/10)");
const lh = spot("vestkysten");
const rlh = row({ time: "2026-10-13T13:00", hs: 1.5, tp: 6, swdir: 180, wdir: 200, wspd: 10, gust: 13 });
const hist = computeStats([rlh], lh).days.get("2026-10-13")!.max;
const direct = scoreSpot(rlh, lh.shoreNormal, spotOpts(lh));
check("Langerhuse H med sidevind: høfdens læ tæller i historikken", near(hist, direct, 1e-9), `${hist.toFixed(2)} vs ${direct.toFixed(2)}`);
const ind = spot("indsejlingen");
const ri = row({ time: "2026-10-11T12:00", hs: 2.0, tp: 7, swdir: 320, wdir: 140, wspd: 10 });
const histI = computeStats([ri], ind).days.get("2026-10-11")!.max;
check("Indsejlingen: molen tæller i historikken", near(histI, scoreSpot(ri, ind.shoreNormal, spotOpts(ind)), 1e-9), histI.toFixed(2));

done("model");
