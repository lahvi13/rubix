/**
 * A result as a picture to post: drawn here, in the app's own colours and
 * faces, and handed to the phone's share sheet. Nothing goes over the network
 * — the image is built on the device and the reader chooses where it goes.
 */

import type { Face } from '../domain/cube/notation';
import type { CubeState } from '../domain/cube/state';
import { downloadBlob } from './download';
import { WORDMARK } from './wordmark';
import { canShareFile, shareFile } from './share';

export interface ShareCard {
  /** What the number is: "Single", "ao5". */
  kicker: string;
  /** The number itself, as the app writes it. */
  headline: string;
  /** A record it holds, if any. */
  badge: string | null;
  /** The scramble, or the times of an average — read in a monospaced face. */
  detail: string;
  /** When it was done. */
  date: string;
  /**
   * The cube the detail scrambles, drawn unfolded beside it — what somebody
   * scrolling past can see without reading moves. Null where there is no one
   * cube behind the card, as with an average.
   */
  cube: CubeState | null;
}

export interface CardLook {
  /** The reader's cube colours, for the name in the corner. */
  faces: Record<Face, string>;
  /** `cube` drawn in the reader's skin, NET_WIDTH across, as an image URL. */
  cube: string | null;
}

/** How wide the unfolded cube is drawn on the card. */
export const NET_WIDTH = 400;

/** Square, the one shape every place a cuber posts to shows whole. */
const SIZE = 1080;
const PAD = 96;
const WIDTH = SIZE - 2 * PAD;
const SITE = 'rubix.lahvi.cz';

interface Palette {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  warn: string;
  /** --sticker-ink: the letters of the name, on its coloured stickers. */
  stickerInk: string;
  sans: string;
  mono: string;
  clock: string;
}

/**
 * The palette as the page has it right now. A custom property reads back as
 * written — `light-dark(…)` — so each is put on a probe and read off as the
 * colour or face the browser actually resolved, theme and clock face included.
 */
function readPalette(): Palette {
  const probe = document.createElement('span');
  probe.hidden = true;
  document.body.append(probe);
  const read = (property: 'color' | 'fontFamily', token: string): string => {
    probe.style[property] = `var(${token})`;
    return getComputedStyle(probe)[property];
  };
  const palette: Palette = {
    bg: read('color', '--bg'),
    text: read('color', '--text'),
    muted: read('color', '--muted'),
    accent: read('color', '--accent'),
    warn: read('color', '--warn'),
    stickerInk: read('color', '--sticker-ink'),
    sans: read('fontFamily', '--font-sans'),
    mono: read('fontFamily', '--font-mono'),
    clock: read('fontFamily', '--font-clock'),
  };
  probe.remove();
  return palette;
}

/** Faces load on first use, and a canvas does not wait for them. */
async function loadFaces(palette: Palette): Promise<void> {
  await Promise.all(
    [
      `600 48px ${palette.sans}`,
      `700 48px ${palette.sans}`,
      `500 48px ${palette.mono}`,
      `400 48px ${palette.clock}`,
    ].map(
      (font) => document.fonts.load(font).catch(() => []),
    ),
  );
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}

/** Words onto lines no wider than the width, breaking only at spaces. */
function wrap(context: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (line !== '' && context.measureText(candidate).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The largest size, up to `max`, at which the text fits the width. */
function fittedSize(context: CanvasRenderingContext2D, text: string, font: (size: number) => string, max: number): number {
  let size = max;
  context.font = font(size);
  while (size > 40 && context.measureText(text).width > WIDTH) {
    size -= 8;
    context.font = font(size);
  }
  return size;
}

/*
 * The name in the corner, as stickers (lib/wordmark.ts) — the one place on a
 * quiet card that says what it is about.
 */
const TILE = 54;
const TILE_GAP = 8;

/** Drawn centred on `middle`, the height of the date across from it. */
function drawLogo(context: CanvasRenderingContext2D, palette: Palette, look: CardLook, middle: number): void {
  // Heavier than the rest of the card: a letter on a coloured tile needs the
  // weight to read as a letter rather than as a mark on the sticker.
  context.font = `700 34px ${palette.sans}`;
  context.textAlign = 'center';
  const top = middle - TILE / 2;
  WORDMARK.forEach(({ letter, face }, index) => {
    const x = PAD + index * (TILE + TILE_GAP);
    context.fillStyle = look.faces[face];
    context.beginPath();
    context.roundRect(x, top, TILE, TILE, 10);
    context.fill();
    // The page's sticker ink, as the menu's stickers wear it (see
    // --sticker-ink in tokens.css for why it is dark in either theme).
    context.fillStyle = palette.stickerInk;
    const ink = context.measureText(letter);
    context.fillText(letter, x + TILE / 2, middle + (ink.actualBoundingBoxAscent - ink.actualBoundingBoxDescent) / 2);
  });
}

export async function renderShareCard(card: ShareCard, look: CardLook): Promise<Blob> {
  const palette = readPalette();
  const [cube] = await Promise.all([
    look.cube === null ? null : loadImage(look.cube),
    loadFaces(palette),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('no 2D canvas');

  context.fillStyle = palette.bg;
  context.fillRect(0, 0, SIZE, SIZE);
  context.textBaseline = 'alphabetic';

  // The name and the date along the top, as the app's own header carries them.
  context.fillStyle = palette.muted;
  context.textAlign = 'right';
  context.font = `500 30px ${palette.sans}`;
  const dateInk = context.measureText(card.date);
  const dateBaseline = PAD + 32;
  context.fillText(card.date, SIZE - PAD, dateBaseline);
  drawLogo(
    context,
    palette,
    look,
    dateBaseline - (dateInk.actualBoundingBoxAscent - dateInk.actualBoundingBoxDescent) / 2,
  );

  // The middle block, measured first so it can be centred as a whole. The
  // heights come from the glyphs themselves rather than from the size: the
  // seven-segment face stands far taller than its size says, and a block laid
  // out by size put the number over the words above it.
  const kickerFont = `600 48px ${palette.sans}`;
  // The clock's own weight. The seven-segment face comes in one weight only,
  // and asked for a bolder one the browser thickens it by stroking each
  // outline — which blew the pointed ends of its segments up into arrowheads.
  const headlineFont = (size: number) => `400 ${size}px ${palette.clock}`;
  const badgeFont = `600 40px ${palette.sans}`;

  const inkOf = (font: string, text: string) => {
    context.font = font;
    const metrics = context.measureText(text);
    return { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
  };

  const headlineSize = fittedSize(context, card.headline, headlineFont, 200);
  const kicker = inkOf(kickerFont, card.kicker);
  const headline = inkOf(headlineFont(headlineSize), card.headline);
  const badge = card.badge === null ? null : inkOf(badgeFont, card.badge);

  // With a cube, the detail is the column beside it — the moves and the
  // picture they make, read as one — and set a step smaller to fit there.
  const CUBE_GAP = 48;
  const columnX = PAD + NET_WIDTH + CUBE_GAP;
  const detailFont = cube === null ? `500 36px ${palette.mono}` : `500 34px ${palette.mono}`;
  const detailLineHeight = cube === null ? 52 : 50;
  context.font = detailFont;
  const detailLines = wrap(context, card.detail, cube === null ? WIDTH : SIZE - PAD - columnX).slice(0, 6);
  const cubeHeight = cube === null ? 0 : (NET_WIDTH * cube.naturalHeight) / cube.naturalWidth;

  const GAP_AFTER_KICKER = 40;
  const GAP_AFTER_HEADLINE = 44;
  const GAP_BEFORE_DETAIL = cube === null ? 56 : 72;
  const kickerHeight = kicker.ascent + kicker.descent;
  const headlineHeight = headline.ascent + headline.descent;
  const badgeHeight = badge === null ? 0 : GAP_AFTER_HEADLINE + badge.ascent + badge.descent;
  const linesHeight = detailLines.length * detailLineHeight;
  const rowHeight = Math.max(cubeHeight, linesHeight);
  const detailHeight = rowHeight === 0 ? 0 : GAP_BEFORE_DETAIL + rowHeight;
  const blockHeight = kickerHeight + GAP_AFTER_KICKER + headlineHeight + badgeHeight + detailHeight;
  let y = (SIZE - blockHeight) / 2;

  context.textAlign = 'center';
  context.font = kickerFont;
  context.fillStyle = palette.muted;
  context.fillText(card.kicker, SIZE / 2, y + kicker.ascent);
  y += kickerHeight + GAP_AFTER_KICKER;

  context.font = headlineFont(headlineSize);
  context.fillStyle = palette.text;
  context.fillText(card.headline, SIZE / 2, y + headline.ascent);
  y += headlineHeight;

  if (card.badge !== null && badge !== null) {
    y += GAP_AFTER_HEADLINE;
    context.font = badgeFont;
    context.fillStyle = palette.warn;
    context.fillText(card.badge, SIZE / 2, y + badge.ascent);
    y += badge.ascent + badge.descent;
  }

  if (rowHeight > 0) {
    y += GAP_BEFORE_DETAIL;
    context.font = detailFont;
    context.fillStyle = palette.muted;
    if (cube === null) {
      for (const line of detailLines) {
        context.fillText(line, SIZE / 2, y + 36);
        y += detailLineHeight;
      }
    } else {
      context.drawImage(cube, PAD, y + (rowHeight - cubeHeight) / 2, NET_WIDTH, cubeHeight);
      context.textAlign = 'left';
      let lineY = y + (rowHeight - linesHeight) / 2;
      for (const line of detailLines) {
        context.fillText(line, columnX, lineY + 34);
        lineY += detailLineHeight;
      }
      context.textAlign = 'center';
    }
  }

  // Where it came from, at the foot: the one line a stranger needs.
  context.font = `600 32px ${palette.sans}`;
  context.fillStyle = palette.accent;
  context.fillText(SITE, SIZE / 2, SIZE - PAD);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('no image')) : resolve(blob)), 'image/png');
  });
}

export type CardOutcome = 'shared' | 'cancelled' | 'downloaded';

/**
 * Draws the card and hands it on: to the share sheet where there is one that
 * takes images, and as a download where there is not (a desktop browser). A
 * share that fails outright falls back to the download too — the picture is
 * made, and the reader should end up holding it.
 */
export async function deliverShareCard(
  card: ShareCard,
  look: CardLook,
  filename: string,
  message: string | null,
): Promise<CardOutcome> {
  const blob = await renderShareCard(card, look);
  const file = new File([blob], filename, { type: 'image/png' });

  if (canShareFile(file)) {
    const outcome = await shareFile(file, message);
    if (outcome !== 'failed') return outcome;
  }
  downloadBlob(filename, blob);
  return 'downloaded';
}
