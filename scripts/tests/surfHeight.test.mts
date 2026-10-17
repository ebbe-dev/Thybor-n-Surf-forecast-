// Bølgens front (src/lib/surfHeight.ts): Komar & Gaughan og talformatet.
import { breakerHeight, fmtSurfHeight } from "../../src/lib/surfHeight";
import { check, near, done } from "./lib.mts";

console.log("Komar & Gaughan");
check("1,5 m / 6 s → ~1,74 m (docs: ~1,7)", near(breakerHeight(1.5, 6), 1.74, 0.02), breakerHeight(1.5, 6).toFixed(3));
check("1,5 m / 10 s → ~2,14 m (docs: ~2,1)", near(breakerHeight(1.5, 10), 2.14, 0.02), breakerHeight(1.5, 10).toFixed(3));
check("0,5 m / 5 s → ~0,67 m", near(breakerHeight(0.5, 5), 0.673, 0.01), breakerHeight(0.5, 5).toFixed(3));
check("ingen sø eller ingen periode → 0", breakerHeight(0, 6) === 0 && breakerHeight(1, 0) === 0);
check("fronten vokser med perioden", breakerHeight(1.5, 10) > breakerHeight(1.5, 6));
check("fronten vokser med højden", breakerHeight(2, 6) > breakerHeight(1.5, 6));
check("1 m / 8 s: fronten er større end Hs", breakerHeight(1, 8) > 1);

console.log("formatet");
check("1,74 → '1,7 m'", fmtSurfHeight(1.74) === "1,7 m", fmtSurfHeight(1.74));
check("0,673 → '65 cm'", fmtSurfHeight(0.673) === "65 cm", fmtSurfHeight(0.673));
check("0,98 → '1,0 m'", fmtSurfHeight(0.98) === "1,0 m", fmtSurfHeight(0.98));
check("0,96 → '95 cm'", fmtSurfHeight(0.96) === "95 cm", fmtSurfHeight(0.96));
check("0 → '0 cm'", fmtSurfHeight(0) === "0 cm");

done("surfHeight");
