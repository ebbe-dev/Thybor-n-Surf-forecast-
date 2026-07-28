// Genererer PWA-ikoner uden billedafhængigheder: rå PNG via zlib.
// Motiv: barograf-søjler i scoreskalaens farver på appens baggrund.
// Kør: node scripts/gen-icons.mjs

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";

const BG = [0x0b, 0x19, 0x17];
const BARS = ["#2C5C55", "#1F4741", "#C2AC83", "#E2542A", "#FF7A45"].map((h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16)
]);
// Søjlehøjder som andel af tegnefeltet (stigende mod "Aflys hvad du har")
const HEIGHTS = [0.22, 0.38, 0.55, 0.75, 0.95];

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
  // pixelbuffer
  const px = Buffer.alloc(size * size * 3);
  for (let i = 0; i < size * size; i++) px.set(BG, i * 3);

  // sikker zone til maskable: tegn i midterste 60 %
  const pad = Math.round(size * 0.2);
  const field = size - 2 * pad;
  const gap = Math.max(2, Math.round(field * 0.06));
  const barW = Math.floor((field - gap * (BARS.length - 1)) / BARS.length);
  const baseline = size - pad;

  BARS.forEach((rgb, i) => {
    const h = Math.round(field * HEIGHTS[i]);
    const x0 = pad + i * (barW + gap);
    for (let y = baseline - h; y < baseline; y++) {
      for (let x = x0; x < x0 + barW; x++) px.set(rgb, (y * size + x) * 3);
    }
  });

  // scanlines med filterbyte 0
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0;
    px.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bitdybde
  ihdr[9] = 2; // truecolor
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
