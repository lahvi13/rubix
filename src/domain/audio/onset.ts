/**
 * Hears the solver say a short word — "hop" — at the end of a phase, and says
 * when it began. Not speech recognition: what is said does not matter, only
 * that a voice started.
 *
 * The enemy is the cube itself. A layer clicking is a short broadband crack,
 * and a finger tapping the cube or the table is the same kind of sound — so
 * rather than listen for a tap, this listens for a voice, which differs from
 * the cube in being periodic: a vowel repeats at its pitch, turning noise does
 * not. Every hop asks whether the last few tens of milliseconds repeat, and a
 * voice is a stretch that keeps repeating for CONFIRM_MS.
 *
 * Periodicity decides, loudness only gates. Deciding on loudness first meant
 * that a solve's turning noise, loud and long, held the detector busy — and
 * the word said mid-turn, straight into the next phase, was never heard.
 *
 * The gate floats above a floor that follows the room: a low percentile of the
 * recent level, which a rattle that goes on becomes part of within a fraction
 * of a second, while a word or a click, too short to reach the percentile,
 * leaves it where it was.
 *
 * Runs on the audio thread, once per 128-sample block: the state is mutated in
 * place and nothing is allocated per sample, where an immutable step would
 * make garbage hundreds of times a second.
 */

/** Bumped whenever a change here makes old trial results incomparable. */
export const DETECTOR_VERSION = 1;

const HOP_MS = 5;
/** The band a voice's fundamental and first formant live in; clicks mostly do not. */
const LOW_CUT_HZ = 150;
const HIGH_CUT_HZ = 1000;
/** How far above the floor a voice has to be to count. */
const GATE_DB = 6;
/** Below this nothing counts, however quiet the room: dead silence is not a floor to measure from. */
const MIN_LEVEL_DB = -70;
const FLOOR_WINDOW_MS = 1500;
const FLOOR_PERCENTILE = 0.2;
/** How long a voice has to hold before it is one. */
const CONFIRM_MS = 50;
/** Unvoiced hops a candidate survives: a consonant inside a word. */
const CANDIDATE_GAP_HOPS = 2;
/** Unvoiced time needed after a word before the next one can start. */
const REARM_MS = 150;
/** The voicing check runs on a thinned copy of the band — the band ends at 1 kHz. */
const VOICING_RATE_HZ = 8000;
const VOICING_WINDOW_MS = 40;
const PITCH_MIN_HZ = 70;
const PITCH_MAX_HZ = 400;
/** Normalised autocorrelation a hop has to reach at some pitch to be voiced. */
const VOICED = 0.5;

export interface OnsetDetector {
  /**
   * Feeds the next samples of the stream. Returns where each voice decided on
   * inside them began, as sample indices counted from the first sample pushed.
   */
  push(samples: Float32Array): readonly number[];
  /** Band level of the last hop, in dB relative to full scale. */
  readonly levelDb: number;
  /** The level a voice has to reach right now to count. */
  readonly gateDb: number;
}

const NOTHING: readonly number[] = [];

interface Biquad {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
  z1: number;
  z2: number;
}

/** RBJ cookbook second-order section, Q = 1/√2. */
function biquad(kind: 'highpass' | 'lowpass', cutoffHz: number, sampleRate: number): Biquad {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / Math.SQRT2;
  const a0 = 1 + alpha;
  const outer = (kind === 'highpass' ? (1 + cos) / 2 : (1 - cos) / 2) / a0;
  const middle = (kind === 'highpass' ? -(1 + cos) : 1 - cos) / a0;
  return {
    b0: outer,
    b1: middle,
    b2: outer,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
    z1: 0,
    z2: 0,
  };
}

function filter(section: Biquad, x: number): number {
  const y = section.b0 * x + section.z1;
  section.z1 = section.b1 * x - section.a1 * y + section.z2;
  section.z2 = section.b2 * x - section.a2 * y;
  return y;
}

function toDb(meanSquare: number): number {
  return 10 * Math.log10(meanSquare + 1e-12);
}

/**
 * The strongest normalised autocorrelation of `window` at any lag in
 * [minLag, maxLag] — near 1 for a vowel at its pitch period, low for noise.
 */
export function periodicity(window: Float32Array, minLag: number, maxLag: number): number {
  let best = 0;
  for (let lag = minLag; lag <= maxLag && lag < window.length; lag++) {
    let xy = 0;
    let xx = 0;
    let yy = 0;
    for (let i = 0; i + lag < window.length; i++) {
      const a = window[i] ?? 0;
      const b = window[i + lag] ?? 0;
      xy += a * b;
      xx += a * a;
      yy += b * b;
    }
    const r = xy / Math.sqrt(xx * yy + 1e-20);
    if (r > best) best = r;
  }
  return best;
}

export function createOnsetDetector(sampleRate: number): OnsetDetector {
  const hopSamples = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
  const confirmHops = Math.ceil(CONFIRM_MS / HOP_MS);
  const rearmHops = Math.ceil(REARM_MS / HOP_MS);

  const highpass = biquad('highpass', LOW_CUT_HZ, sampleRate);
  const lowpass = biquad('lowpass', HIGH_CUT_HZ, sampleRate);

  const decimation = Math.max(1, Math.round(sampleRate / VOICING_RATE_HZ));
  const voicingRate = sampleRate / decimation;
  const ring = new Float32Array(Math.ceil((voicingRate * VOICING_WINDOW_MS) / 1000));
  const window = new Float32Array(ring.length);
  const minLag = Math.floor(voicingRate / PITCH_MAX_HZ);
  const maxLag = Math.min(Math.ceil(voicingRate / PITCH_MIN_HZ), Math.floor(ring.length / 2));
  let ringAt = 0;
  /*
   * Periodicity only shows once the vowel fills most of the window, so a hop
   * is first found voiced about this long after the voice began — and that
   * is where the onset is dated back to.
   */
  const voicingDelaySamples = Math.round(ring.length * decimation * 0.25);

  const levels = new Float32Array(Math.round(FLOOR_WINDOW_MS / HOP_MS));
  const sorted = new Float32Array(levels.length);
  let levelsAt = 0;
  let levelCount = 0;

  let position = 0;
  let hopFill = 0;
  let hopSum = 0;
  let previousHopMeanSquare = 0;
  let levelDb = -100;
  let gateDb = MIN_LEVEL_DB;

  let phase: 'quiet' | 'candidate' | 'active' = 'quiet';
  let candidateStart = 0;
  let voicedHops = 0;
  let unvoicedHops = 0;

  function floorDb(): number {
    // Sorted in place: a percentile of a copy, with nothing allocated.
    const count = levelCount;
    for (let i = 0; i < count; i++) sorted[i] = levels[i] ?? 0;
    const view = sorted.subarray(0, count);
    view.sort();
    return view[Math.floor((count - 1) * FLOOR_PERCENTILE)] ?? -100;
  }

  function isVoicedHop(): boolean {
    if (levelDb < gateDb) return false;
    // Oldest sample first, the way the autocorrelation reads it.
    for (let i = 0; i < ring.length; i++) window[i] = ring[(ringAt + i) % ring.length] ?? 0;
    return periodicity(window, minLag, maxLag) >= VOICED;
  }

  function endHop(): number | null {
    const meanSquare = hopSum / hopSamples;
    // Two hops, not one: a low voice's pitch period is longer than a hop, and
    // one hop alone flickers with where in the period it happened to fall.
    levelDb = toDb((meanSquare + previousHopMeanSquare) / 2);
    previousHopMeanSquare = meanSquare;

    levels[levelsAt] = levelDb;
    levelsAt = (levelsAt + 1) % levels.length;
    levelCount = Math.min(levelCount + 1, levels.length);
    gateDb = Math.max(floorDb() + GATE_DB, MIN_LEVEL_DB);

    const isVoiced = isVoicedHop();
    let onset: number | null = null;

    switch (phase) {
      case 'quiet':
        if (isVoiced) {
          phase = 'candidate';
          candidateStart = Math.max(0, position - voicingDelaySamples);
          voicedHops = 1;
          unvoicedHops = 0;
        }
        break;
      case 'candidate':
        if (isVoiced) {
          voicedHops++;
          unvoicedHops = 0;
        } else if (++unvoicedHops > CANDIDATE_GAP_HOPS) {
          // Periodic, but not for long enough to be a word: a cube ringing
          // for a moment after a click.
          phase = 'quiet';
          break;
        }
        if (voicedHops >= confirmHops) {
          onset = candidateStart;
          phase = 'active';
          unvoicedHops = 0;
        }
        break;
      case 'active':
        unvoicedHops = isVoiced ? 0 : unvoicedHops + 1;
        if (unvoicedHops >= rearmHops) phase = 'quiet';
        break;
    }
    return onset;
  }

  return {
    push(samples) {
      let onsets: number[] | null = null;
      for (let i = 0; i < samples.length; i++) {
        const band = filter(lowpass, filter(highpass, samples[i] ?? 0));
        if (position % decimation === 0) {
          ring[ringAt] = band;
          ringAt = (ringAt + 1) % ring.length;
        }
        hopSum += band * band;
        hopFill++;
        position++;
        if (hopFill === hopSamples) {
          const onset = endHop();
          hopFill = 0;
          hopSum = 0;
          if (onset !== null) (onsets ??= []).push(onset);
        }
      }
      return onsets ?? NOTHING;
    },
    get levelDb() {
      return levelDb;
    },
    get gateDb() {
      return gateDb;
    },
  };
}
