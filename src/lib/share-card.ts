/**
 * A result as a picture to post: drawn here, in the app's own colours and
 * faces, and handed to the phone's share sheet. Nothing goes over the network
 * — the image is built on the device and the reader chooses where it goes.
 */

import { downloadBlob } from './download';
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
}

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
    [`600 48px ${palette.sans}`, `500 48px ${palette.mono}`, `600 48px ${palette.clock}`].map(
      (font) => document.fonts.load(font).catch(() => []),
    ),
  );
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

export async function renderShareCard(card: ShareCard): Promise<Blob> {
  const palette = readPalette();
  await loadFaces(palette);

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('no 2D canvas');

  context.fillStyle = palette.bg;
  context.fillRect(0, 0, SIZE, SIZE);
  context.textBaseline = 'alphabetic';

  // The name and the date along the top, as the app's own header carries them.
  context.font = `600 34px ${palette.sans}`;
  context.fillStyle = palette.muted;
  context.textAlign = 'left';
  context.letterSpacing = '6px';
  context.fillText('RUBIX', PAD, PAD + 34);
  context.letterSpacing = '0px';
  context.textAlign = 'right';
  context.font = `500 30px ${palette.sans}`;
  context.fillText(card.date, SIZE - PAD, PAD + 32);

  // The middle block, measured first so it can be centred as a whole. The
  // heights come from the glyphs themselves rather than from the size: the
  // seven-segment face stands far taller than its size says, and a block laid
  // out by size put the number over the words above it.
  const kickerFont = `600 38px ${palette.sans}`;
  const headlineFont = (size: number) => `600 ${size}px ${palette.clock}`;
  const badgeFont = `600 40px ${palette.sans}`;
  const detailFont = `500 36px ${palette.mono}`;

  const inkOf = (font: string, text: string) => {
    context.font = font;
    const metrics = context.measureText(text);
    return { ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent };
  };

  const headlineSize = fittedSize(context, card.headline, headlineFont, 260);
  const kicker = inkOf(kickerFont, card.kicker);
  const headline = inkOf(headlineFont(headlineSize), card.headline);
  const badge = card.badge === null ? null : inkOf(badgeFont, card.badge);
  context.font = detailFont;
  const detailLines = wrap(context, card.detail, WIDTH).slice(0, 6);
  const detailLineHeight = 52;

  const GAP_AFTER_KICKER = 40;
  const GAP_AFTER_HEADLINE = 44;
  const GAP_BEFORE_DETAIL = 56;
  const kickerHeight = kicker.ascent + kicker.descent;
  const headlineHeight = headline.ascent + headline.descent;
  const badgeHeight = badge === null ? 0 : GAP_AFTER_HEADLINE + badge.ascent + badge.descent;
  const detailHeight =
    detailLines.length === 0 ? 0 : GAP_BEFORE_DETAIL + detailLines.length * detailLineHeight;
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

  if (detailLines.length > 0) {
    y += GAP_BEFORE_DETAIL;
    context.font = detailFont;
    context.fillStyle = palette.muted;
    for (const line of detailLines) {
      context.fillText(line, SIZE / 2, y + 36);
      y += detailLineHeight;
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
export async function deliverShareCard(card: ShareCard, filename: string): Promise<CardOutcome> {
  const blob = await renderShareCard(card);
  const file = new File([blob], filename, { type: 'image/png' });

  if (canShareFile(file)) {
    const outcome = await shareFile(file);
    if (outcome !== 'failed') return outcome;
  }
  downloadBlob(filename, blob);
  return 'downloaded';
}
