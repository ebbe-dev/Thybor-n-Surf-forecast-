// Skærmbilleder af appen med seedede data og uden net: NU øverst, hele NU
// og KORT. Starter selv `vite preview` på dist/ (kør `npm run build`
// først) og lukker den igen. Telefon-viewport 412×915, dansk tidszone,
// service worker blokeret, Open-Meteo/OSM/raw.githubusercontent afvist.
//
//   node scripts/tests/screenshots.mjs <mappe>

import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { seedForecast, seedObs } from "./seed.mjs";

const outDir = resolve(process.argv[2] ?? "scripts/tests/out");
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/Thybor-n-Surf-forecast-/`;
mkdirSync(outDir, { recursive: true });

// Playwrights egen chromium, hvis den er hentet; ellers den, der ligger i
// Claude-containeren (/opt/pw-browsers), eller CHROMIUM_PATH.
function chromiumPath() {
  const cands = [
    process.env.CHROMIUM_PATH,
    "/opt/pw-browsers/chromium",
    "/opt/pw-browsers/chromium/chrome-linux/chrome",
    "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
  ].filter(Boolean);
  for (const c of cands) if (existsSync(c) && statSync(c).isFile()) return c;
  return undefined;
}

async function waitFor(url, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      // ikke oppe endnu
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("vite preview svarer ikke på " + url);
}

export async function withApp(fn) {
  const preview = spawn(
    process.execPath,
    [resolve("node_modules/vite/bin/vite.js"), "preview", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"],
    { stdio: "ignore" }
  );
  let browser = null;
  try {
    await waitFor(BASE);
    browser = await chromium.launch({ executablePath: chromiumPath() });
    const ctx = await browser.newContext({
      viewport: { width: 412, height: 915 },
      deviceScaleFactor: 2,
      timezoneId: "Europe/Copenhagen",
      locale: "da-DK",
      serviceWorkers: "block"
    });
    await ctx.route(/open-meteo\.com|tile\.openstreetmap\.org|raw\.githubusercontent\.com/, (r) => r.abort());
    const now = new Date();
    await ctx.addInitScript(
      (s) => {
        localStorage.setItem("bygtangen.forecast3", JSON.stringify(s.forecast));
        localStorage.setItem("bygtangen.obs1", JSON.stringify(s.obs));
        for (const [k, v] of Object.entries(s.extra ?? {})) localStorage.setItem(k, v);
      },
      { forecast: seedForecast(now), obs: seedObs(now), extra: process.env.SEED_EXTRA ? JSON.parse(process.env.SEED_EXTRA) : {} }
    );
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      // afviste kald (Open-Meteo, fliser, obs.json) er ventet uden net
      if (m.type() === "error" && !/ERR_FAILED|Failed to load resource/.test(m.text())) errors.push(m.text());
    });
    await fn(page, BASE, errors);
    if (errors.length) console.log("fejl i siden:\n  " + errors.join("\n  "));
  } finally {
    if (browser) await browser.close();
    preview.kill();
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (isMain) {
  await withApp(async (page, base) => {
    await page.goto(base);
    await page.waitForSelector(".hero");
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${outDir}/nu-top.png` });
    await page.screenshot({ path: `${outDir}/nu-fuld.png`, fullPage: true });
    await page.getByRole("button", { name: "KORT", exact: true }).click();
    await page.waitForSelector(".leaflet-container");
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${outDir}/kort.png` });
    console.log("skærmbilleder i " + outDir);
  });
}
