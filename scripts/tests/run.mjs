// Kører testene i scripts/tests/*.test.mts: hver fil bundles med rolldown
// (Vites bundler, allerede i node_modules), fordi Node ikke løser appens
// extensionless TypeScript-imports, og køres så i Node med dansk tidszone.
// Kun rene regler testes her (model, lib); browseren testes i
// browser.test.mjs. Testene ligger i repoet, så de overlever sessionen.
//   npm test              alle
//   npm test -- model     kun filer med "model" i navnet
import { rolldown } from "rolldown";
import { readdirSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const dir = resolve("scripts/tests");
const out = resolve(dir, ".bundled");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const only = process.argv.slice(2);
const files = readdirSync(dir)
  .filter((f) => /\.test\.m?ts$/.test(f))
  .filter((f) => only.length === 0 || only.some((o) => f.includes(o)))
  .sort();
if (files.length === 0) {
  console.log("ingen testfiler");
  process.exit(1);
}

let failed = 0;
for (const f of files) {
  const name = f.replace(/\.m?ts$/, ".mjs");
  const bundle = await rolldown({
    input: resolve(dir, f),
    platform: "node",
    resolve: { extensions: [".ts", ".tsx", ".mts", ".js", ".mjs", ".json"] },
    logLevel: "warn"
  });
  await bundle.write({ dir: out, format: "esm", entryFileNames: name, sourcemap: false });
  await bundle.close();
  console.log(`\n▶ ${f}`);
  const r = spawnSync(process.execPath, [resolve(out, name)], {
    stdio: "inherit",
    env: { ...process.env, TZ: "Europe/Copenhagen" }
  });
  if (r.status !== 0) failed++;
}
console.log(failed ? `\n${failed} testfil(er) fejlede` : "\nalle testfiler ok");
process.exit(failed ? 1 : 0);
