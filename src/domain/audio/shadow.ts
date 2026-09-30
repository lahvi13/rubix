/**
 * The voice trial: while phases are still ended by tapping, the microphone
 * listens alongside, and each solve leaves a record of both. The taps are the
 * truth; the question the records answer is whether the voice would have got
 * the same boundaries — which it missed, which it invented, and how far off
 * the ones it got were.
 *
 * The records are the raw times, not the verdict: a better matcher, or a
 * detector tuned against them, can go over the same solves again.
 */

import { isVerdict, type Sound, type Verdict } from './onset';

/** How far a voice may be from a tap and still be the same boundary. */
export const MATCH_WINDOW_MS = 400;

/**
 * One sound the detector judged, taken or not, with what it was judged on —
 * kept so the next tuning can be read off real rooms. Rounded: it is read by
 * a person, and a log of a hundred solves should stay small.
 */
export interface ShadowSound {
  /** From the start of the solve. */
  atMs: number;
  verdict: Verdict;
  durationMs: number;
  /** 0–1, two decimals. */
  periodicity: number;
  pitchHz: number;
  /** 0–1, two decimals. */
  steadiness: number;
  loudnessDb: number;
}

export interface ShadowRecord {
  /** DETECTOR_VERSION of the detector that heard it. */
  detector: number;
  /** Phase boundaries tapped, from the start of the solve. */
  splitMs: readonly number[];
  rawMs: number;
  /** Voices heard during the solve, from its start. */
  voiceMs: readonly number[];
  /**
   * Every sound judged during the solve. Absent from records of detector 1;
   * detector 2 wrote them without a verdict, and they are not read back.
   */
  sounds?: readonly ShadowSound[];
}

export function shadowSound(atMs: number, sound: Omit<Sound, 'at'>): ShadowSound {
  const hundredths = (value: number) => Math.round(value * 100) / 100;
  return {
    atMs: Math.round(atMs),
    verdict: sound.verdict,
    durationMs: Math.round(sound.durationMs),
    periodicity: hundredths(sound.periodicity),
    pitchHz: Math.round(sound.pitchHz),
    steadiness: hundredths(sound.steadiness),
    loudnessDb: Math.round(sound.loudnessDb),
  };
}

export interface ShadowMatch {
  /** Boundaries tapped. */
  boundaries: number;
  /** Of those, how many the voice would have got. */
  heard: number;
  /** Voices that were no boundary at all. Said at the stop does not count against it. */
  extra: number;
  /** Voice minus tap, for every boundary heard; positive is a voice after its tap. */
  offsetsMs: readonly number[];
}

export function matchShadow(record: ShadowRecord): ShadowMatch {
  // Closest pairs first, so one voice between two taps goes to the nearer.
  const pairs: { tap: number; voice: number; gap: number }[] = [];
  record.splitMs.forEach((tapMs, tap) => {
    record.voiceMs.forEach((voiceMs, voice) => {
      const gap = voiceMs - tapMs;
      if (Math.abs(gap) <= MATCH_WINDOW_MS) pairs.push({ tap, voice, gap });
    });
  });
  pairs.sort((a, b) => Math.abs(a.gap) - Math.abs(b.gap));

  const tapsTaken = new Set<number>();
  const voicesTaken = new Set<number>();
  const offsets: { tap: number; gap: number }[] = [];
  for (const pair of pairs) {
    if (tapsTaken.has(pair.tap) || voicesTaken.has(pair.voice)) continue;
    tapsTaken.add(pair.tap);
    voicesTaken.add(pair.voice);
    offsets.push({ tap: pair.tap, gap: pair.gap });
  }

  // "Hop" said with the tap that stopped the clock is a habit the trial asks
  // for, not a mistake — the real thing will never stop the clock by voice.
  const extra = record.voiceMs.filter(
    (voiceMs, voice) => !voicesTaken.has(voice) && voiceMs < record.rawMs - MATCH_WINDOW_MS,
  ).length;

  return {
    boundaries: record.splitMs.length,
    heard: offsets.length,
    extra,
    offsetsMs: offsets.sort((a, b) => a.tap - b.tap).map((offset) => offset.gap),
  };
}

export interface ShadowSummary {
  solves: number;
  boundaries: number;
  heard: number;
  extra: number;
  /** Typical voice minus tap; null until something has been heard. */
  medianOffsetMs: number | null;
  /** How far nine in ten boundaries heard stay from that median. */
  spreadMs: number | null;
}

/** Only records of `detector`: a retuned detector starts its tally afresh. */
export function summariseShadow(records: readonly ShadowRecord[], detector: number): ShadowSummary {
  let solves = 0;
  let boundaries = 0;
  let heard = 0;
  let extra = 0;
  const offsets: number[] = [];
  for (const record of records) {
    if (record.detector !== detector) continue;
    const match = matchShadow(record);
    solves++;
    boundaries += match.boundaries;
    heard += match.heard;
    extra += match.extra;
    offsets.push(...match.offsetsMs);
  }

  const median = quantile(offsets, 0.5);
  const spread =
    median === null ? null : quantile(offsets.map((offset) => Math.abs(offset - median)), 0.9);
  return {
    solves,
    boundaries,
    heard,
    extra,
    medianOffsetMs: median === null ? null : Math.round(median),
    spreadMs: spread === null ? null : Math.round(spread),
  };
}

/** Linear interpolation between the closest ranks. */
function quantile(values: readonly number[], q: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (sorted.length - 1) * q;
  const below = sorted[Math.floor(rank)] ?? 0;
  const above = sorted[Math.ceil(rank)] ?? below;
  return below + (above - below) * (rank - Math.floor(rank));
}

/**
 * The records stored on this device, as far as they can be read. What is
 * stored came from an earlier or later version of the app as easily as from
 * this one, so it is checked rather than trusted.
 */
export function readShadowRecords(stored: readonly unknown[]): ShadowRecord[] {
  const records: ShadowRecord[] = [];
  for (const value of stored) {
    if (typeof value !== 'object' || value === null) continue;
    const record: Partial<Record<keyof ShadowRecord, unknown>> = value;
    const { detector, rawMs, splitMs, voiceMs, sounds } = record;
    if (
      typeof detector !== 'number' ||
      typeof rawMs !== 'number' ||
      !isNumberList(splitMs) ||
      !isNumberList(voiceMs)
    ) {
      continue;
    }
    records.push(
      Array.isArray(sounds)
        ? { detector, rawMs, splitMs, voiceMs, sounds: sounds.filter(isShadowSound) }
        : { detector, rawMs, splitMs, voiceMs },
    );
  }
  return records;
}

function isShadowSound(value: unknown): value is ShadowSound {
  if (typeof value !== 'object' || value === null) return false;
  const sound: Partial<Record<keyof ShadowSound, unknown>> = value;
  return (
    isVerdict(sound.verdict) &&
    [sound.atMs, sound.durationMs, sound.periodicity, sound.pitchHz, sound.steadiness, sound.loudnessDb].every(
      (field) => typeof field === 'number',
    )
  );
}

function isNumberList(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number');
}
