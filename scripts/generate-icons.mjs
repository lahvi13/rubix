/**
 * Generates the PWA icons: a cube face on the app background.
 *
 * Written by hand with zlib instead of pulling in an image library — the
 * shapes are axis-aligned rectangles, so it is just pixel arithmetic, and the
 * build stays free of a dependency used exactly once.
 *
 * Run: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BACKGROUND = [15, 17, 21];
const STICKERS = [
  [245, 245, 245],
  [255, 213, 0],
  [196, 30, 58],
  [255, 88, 0],
  [0, 81, 186],
  [0, 158, 96],
];
/** Fixed pattern so the icon never changes between runs. */
const FACE = [0, 4, 1, 2, 5, 0, 3, 1, 4];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixelAt) {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** @param padRatio share of the canvas left empty around the face. */
function cubeFace(size, padRatio) {
  const pad = Math.round(size * padRatio);
  const face = size - pad * 2;
  const gap = Math.max(2, Math.round(face * 0.04));
  const cell = Math.floor((face - gap * 2) / 3);

  return (x, y) => {
    const fx = x - pad;
    const fy = y - pad;
    if (fx < 0 || fy < 0 || fx >= face || fy >= face) return BACKGROUND;

    const col = Math.floor(fx / (cell + gap));
    const row = Math.floor(fy / (cell + gap));
    if (col > 2 || row > 2) return BACKGROUND;
    if (fx - col * (cell + gap) >= cell) return BACKGROUND;
    if (fy - row * (cell + gap) >= cell) return BACKGROUND;

    return STICKERS[FACE[row * 3 + col]];
  };
}

const publicDir = join(process.cwd(), 'public');
const icons = [
  ['icon-192.png', 192, 0.1],
  ['icon-512.png', 512, 0.1],
  // Maskable icons get cropped to a circle, so the face sits well inside.
  ['icon-512-maskable.png', 512, 0.22],
  /*
   * iOS never looks at the manifest's icons. Without an apple-touch-icon of
   * the right size it scales whichever one it finds, and without any of them
   * it puts a screenshot of the page on the home screen. 180 is the iPhone,
   * 167 the iPad Pro, 152 every other iPad. They are drawn like the plain
   * icons rather than the maskable one — iOS applies its own rounded-rect
   * mask, which takes off far less than a circle. That the encoder writes no
   * alpha channel matters here: iOS paints transparency black.
   */
  ['apple-touch-icon-180.png', 180, 0.1],
  ['apple-touch-icon-167.png', 167, 0.1],
  ['apple-touch-icon-152.png', 152, 0.1],
];

for (const [name, size, padRatio] of icons) {
  writeFileSync(join(publicDir, name), encodePng(size, cubeFace(size, padRatio)));
  console.log(`wrote public/${name}`);
}
