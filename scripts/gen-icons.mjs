// Genererer PWA-ikoner uden billedafhængigheder: rå PNG via zlib.
// Motiv: en rullende bølge (barrel) med skum og lavthængende sol i
// appens farver. Kør: node scripts/gen-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG = hex("#0B1917");
const CREAM = hex("#E7E2D3");
const TEAL = hex("#2C5C55");
const SUN = hex("#FF7A45");

const dist = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);

// Farven i ét normaliseret punkt (0..1, 0..1). Tegnet inden for
// maskable-sikkerzonen (midterste ~70 %).
function colorAt(x, y) {
  let c = BG;
  // lav sol øverst til højre, fri af krøllen
  if (dist(x, y, 0.79, 0.215) < 0.068) c = SUN;
  // vandet
  if (y > 0.74) c = TEAL;
  const inInner = dist(x, y, 0.565, 0.545) < 0.235;
  // skulderen: bølgeryggen der ruller ind fra venstre …
  if (y > 0.21 && y < 0.3 && x > 0.15 && x < 0.5) c = CREAM;
  // … og krøllen: månesegl der kurver ned mod vandet til højre
  const inOuter = dist(x, y, 0.52, 0.5) < 0.29;
  if (inOuter && !inInner) c = CREAM;
  // skummet for enden af læben
  if (dist(x, y, 0.73, 0.69) < 0.05) c = CREAM;
  return c;
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function png(size) {
  const px = Buffer.alloc(size * size * 3);
  const SS = 2; // 2x2 supersampling mod hakkede kanter
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const i = (y * size + x) * 3;
      px[i] = r / (SS * SS);
      px[i + 1] = g / (SS * SS);
      px[i + 2] = b / (SS * SS);
    }
  }

  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

mkdirSync("public/icons", { recursive: true });
for (const size of [192, 512]) {
  writeFileSync(`public/icons/icon-${size}.png`, png(size));
  console.log(`public/icons/icon-${size}.png`);
}
