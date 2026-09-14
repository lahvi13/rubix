/**
 * Generates the app's icons — the PWA ones and the favicon — as one cube face
 * on the app background. One generator for both, because a browser tab and an
 * installed icon showing two different marks is how a tab stops being findable.
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

function encodePng(width, height, pixelAt) {
  const raw = Buffer.alloc(height * (width * 3 + 1));
  let offset = 0;
  for (let y = 0; y < height; y += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y);
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      offset += 3;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
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

const hex = ([r, g, b]) =>
  `#${[r, g, b].map((value) => value.toString(16).padStart(2, '0')).join('')}`;

/**
 * The same face as an SVG, for the browser tab.
 *
 * Drawn on its own dark tile rather than transparent: a tab strip is light in
 * one browser and dark in the next, and the mark has to be found in both. Its
 * margin is thinner than the home-screen icons' because a tab draws this at
 * sixteen pixels, where every pixel spent on margin comes off a sticker — but
 * not thinner still, or the tile stops being a tile against a dark strip. The
 * numbers divide evenly into 64 so nothing lands on a half pixel.
 */
function faceSvg() {
  const size = 64;
  const pad = 5;
  const gap = 3;
  const cell = 16;

  const cells = FACE.map((sticker, index) => {
    const x = pad + (index % 3) * (cell + gap);
    const y = pad + Math.floor(index / 3) * (cell + gap);
    return `  <rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2.5" fill="${hex(STICKERS[sticker])}"/>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">`,
    `  <rect width="${size}" height="${size}" rx="10" fill="${hex(BACKGROUND)}"/>`,
    ...cells,
    '</svg>',
    '',
  ].join('\n');
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
  writeFileSync(join(publicDir, name), encodePng(size, size, cubeFace(size, padRatio)));
  console.log(`wrote public/${name}`);
}

/*
 * The picture a link to the app is shown with on Reddit, Discord or in a
 * message: 1200×630 is the size they all crop to. The same face, centred, and
 * no lettering — the title and description travel as text beside it, and a
 * name baked into pixels would outlive a rename.
 */
const OG_WIDTH = 1200;
const OG_HEIGHT = 630;
const ogFace = cubeFace(OG_HEIGHT, 0.2);
const ogOffset = Math.round((OG_WIDTH - OG_HEIGHT) / 2);
writeFileSync(
  join(publicDir, 'og-image.png'),
  encodePng(OG_WIDTH, OG_HEIGHT, (x, y) =>
    x < ogOffset || x >= ogOffset + OG_HEIGHT ? BACKGROUND : ogFace(x - ogOffset, y),
  ),
);
console.log('wrote public/og-image.png');

writeFileSync(join(publicDir, 'favicon.svg'), faceSvg());
console.log('wrote public/favicon.svg');
