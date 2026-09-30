/**
 * Hears the solver say a short word — "hop" — at the end of a phase, and says
 * when it began. Not speech recognition: what is said does not matter, only
 * that a voice started.
 *
 * The enemy is everything else in the room. A layer clicking is a short
 * broadband crack, and a finger tapping the cube or the table is the same kind
 * of sound — so rather than listen for a tap, this listens for a voice, which
 * differs from noise in being periodic: a vowel repeats at its pitch. Every
 * hop asks whether the last few tens of milliseconds repeat.
 *
 * Periodic is not enough, though. The first trial on a phone heard a "voice"
 * every second and a half in an ordinary room: a squeak, a clink, somebody
 * talking next door all repeat for a moment. So nothing is decided on a hop
 * or two any more. The voiced hops are gathered into one sound, and the sound
 * is judged whole once it has ended — by its shape:
 *
 * - short and on its own. "Hop" is one syllable with quiet either side;
 *   speech in the background, or a television, runs its syllables together
 *   into a sound far too long to be it;
 * - close. The solver speaks a hand's length from the phone, well above the
 *   room, where most of what else is heard comes from across it;
 * - voiced throughout, not in patches.
 *
 * Calibrated, it also has to be nearly as loud as the solver's own "hop"
 * (see VoiceProfile). Uncalibrated, any close, short voice counts — which is
 * also how calibration itself listens.
 *
 * Judging the whole sound means deciding after it ends, a few hundred
 * milliseconds late. The onset is dated back to where it began, so the delay
 * costs the time nothing.
 *
 * Every sound judged is reported, taken or not, with what it was judged on:
 * the trial keeps those numbers so the next tuning is made against the room
 * rather than against a guess.
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
export const DETECTOR_VERSION = 6;

const HOP_MS = 5;
/** The band a voice's fundamental and first formant live in; clicks mostly do not. */
const LOW_CUT_HZ = 150;
const HIGH_CUT_HZ = 1000;
/** How far above the floor a hop has to be to be part of a sound at all. */
const GATE_DB = 6;
/** Below this nothing counts, however quiet the room: dead silence is not a floor to measure from. */
const MIN_LEVEL_DB = -70;
const FLOOR_WINDOW_MS = 1500;
const FLOOR_PERCENTILE = 0.2;
/** The voicing check runs on a thinned copy of the band — the band ends at 1 kHz. */
const VOICING_RATE_HZ = 8000;
const VOICING_WINDOW_MS = 40;
const PITCH_MIN_HZ = 70;
const PITCH_MAX_HZ = 400;
/** Normalised autocorrelation a hop has to reach at some pitch to be voiced. */
const VOICED = 0.5;
/**
 * Unvoiced time that ends a sound. Shorter gaps are a consonant inside the
 * word, or the gap between two syllables of running speech — which is what
 * makes running speech one long sound instead of many short ones.
 */
const END_GAP_MS = 150;

/**
 * How far below its own loudest a hop may be and still be part of the sound.
 * Measured against the room's floor instead, a word said close to the phone
 * dragged its echo along: the room rang on above the floor, periodic still,
 * and every "hop" of the first test on a phone was turned away as too long.
 * 20 dB still let a couple through at 600 ms; 15 cuts the ringing sooner.
 */
const SOUND_SPAN_DB = 15;

/*
 * What a sound has to be to be taken for "hop". Loudness does most of the
 * work: in four tests on a phone the solver's words stood 60–70 dB above the
 * room, and nothing else in it more than 39 once the detector had heard it.
 */
const VOICE_MIN_MS = 60;
const VOICE_MAX_MS = 800;
/** Mean periodicity over the whole sound, not its best moment. */
const VOICE_MIN_PERIODICITY = 0.55;
/** Loudest hop above the floor: close to the phone, not across the room. */
const VOICE_MIN_LOUDNESS_DB = 30;
/**
 * After a word is taken, how long before another can be. An emphatic "hop"
 * holds the p shut and releases it with a breath of voice of its own, which
 * was heard as a second word. Phases end seconds apart, so this costs nothing.
 */
const REPEAT_MS = 600;
/** How close to the sound's own median a hop's pitch has to be to count as steady. */
const STEADY_SHARE = 0.2;
/**
 * Nothing is judged before the room has been heard for this long: until
 * then its floor is unknown, and the first test on a phone put a word said
 * in the opening second at +112 dB.
 */
const WARM_UP_MS = 500;
/** Below this a hop is a microphone still waking up, handing over zeros — not the room. */
const DIGITAL_SILENCE_DB = -110;

/*
 * Calibrated, a word may not be much quieter than the solver's own "hop".
 * In the tests on a phone their words held within a few dB of each other,
 * while what slipped through without calibration came in 25 dB and more
 * below them.
 *
 * Pitch was tried as a second test and dropped: the band starts above a low
 * voice's fundamental, so the pitch found jumps to its harmonics — the same
 * solver's "hop" came out at 111, 178, 205 and 320 Hz in one test, and was
 * turned away as somebody else's. It is still measured, for the log.
 */
const PROFILE_LOUDNESS_MARGIN_DB = 15;
/** Words heard to calibrate from. */
export const CALIBRATION_WORDS = 5;
/**
 * How alike in loudness the calibration words have to be. Not the first five
 * sounds taken for a word: in a test on a phone two of those were strays 30 dB
 * down, while the solver's five "hop"s sat within 1 dB of each other.
 */
const CALIBRATION_LOUDNESS_DB = 6;

/** The solver's own "hop", as heard where the phone lies while they solve. */
export interface VoiceProfile {
  loudnessDb: number;
}

/**
 * What a sound was taken for. Anything but 'voice' is turned away, and says
 * why — so a missed word shows which of its traits fell short.
 */
export type Verdict = 'voice' | 'long' | 'short' | 'quiet' | 'unclear' | 'repeat';

export const VERDICTS: readonly Verdict[] = ['voice', 'long', 'short', 'quiet', 'unclear', 'repeat'];

export function isVerdict(value: unknown): value is Verdict {
  return VERDICTS.some((verdict) => verdict === value);
}

export interface SoundShape {
  durationMs: number;
  periodicity: number;
  loudnessDb: number;
}

/**
 * Judges a sound's shape, against the solver's voice when there is a profile
 * of it. When several traits fall short, the first in this order is given.
 */
export function judgeSound(sound: SoundShape, voice: VoiceProfile | null): Verdict {
  if (sound.durationMs > VOICE_MAX_MS) return 'long';
  if (sound.durationMs < VOICE_MIN_MS) return 'short';
  const minLoudnessDb =
    voice === null
      ? VOICE_MIN_LOUDNESS_DB
      : Math.max(VOICE_MIN_LOUDNESS_DB, voice.loudnessDb - PROFILE_LOUDNESS_MARGIN_DB);
  if (sound.loudnessDb < minLoudnessDb) return 'quiet';
  if (sound.periodicity < VOICE_MIN_PERIODICITY) return 'unclear';
  return 'voice';
}

type CalibrationSound = Pick<Sound, 'verdict' | 'loudnessDb'>;

/**
 * The largest group of alike words among the sounds heard while calibrating,
 * the loudest group when two are as large. A word taken as a repeat counts:
 * a stray just before it is what made it one.
 */
function calibrationGroup(sounds: readonly CalibrationSound[]): CalibrationSound[] {
  const words = sounds.filter((sound) => sound.verdict === 'voice' || sound.verdict === 'repeat');
  let best: CalibrationSound[] = [];
  for (const word of words) {
    const group = words.filter(
      (other) => Math.abs(other.loudnessDb - word.loudnessDb) <= CALIBRATION_LOUDNESS_DB,
    );
    const isLarger = group.length > best.length;
    const isLouder =
      group.length === best.length &&
      median(group.map((sound) => sound.loudnessDb)) > median(best.map((sound) => sound.loudnessDb));
    if (isLarger || isLouder) best = group;
  }
  return best;
}

/** How many of the calibration words have been heard so far, alike enough to count. */
export function calibrationProgress(sounds: readonly CalibrationSound[]): number {
  return Math.min(CALIBRATION_WORDS, calibrationGroup(sounds).length);
}

/**
 * The solver's voice, from the words heard while calibrating — or null until
 * enough alike ones have been. Medians of the group, which strays are not in.
 */
export function calibrateVoice(sounds: readonly CalibrationSound[]): VoiceProfile | null {
  const group = calibrationGroup(sounds);
  if (group.length < CALIBRATION_WORDS) return null;
  return { loudnessDb: Math.round(median(group.map((word) => word.loudnessDb))) };
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? 0)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

export interface Sound {
  /** Sample index into the stream (counted from the first sample pushed) where it began. */
  at: number;
  verdict: Verdict;
  /** From its first voiced hop to its last. */
  durationMs: number;
  /** Mean normalised autocorrelation over its voiced hops, 0–1. */
  periodicity: number;
  /** Median pitch of its voiced hops. */
  pitchHz: number;
  /** Share of its voiced hops within STEADY_SHARE of that median, 0–1. */
  steadiness: number;
  /** Its loudest hop above the room's floor. */
  loudnessDb: number;
}

export interface OnsetDetector {
  /** Feeds the next samples of the stream; returns every sound that ended inside them. */
  push(samples: Float32Array): readonly Sound[];
  /** Band level of the last hop, in dB relative to full scale. */
  readonly levelDb: number;
  /** The level a hop has to reach right now to be part of a sound. */
  readonly gateDb: number;
}

const NOTHING: readonly Sound[] = [];

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

export interface Periodicity {
  /** Normalised autocorrelation at the period found, 0–1. */
  r: number;
  /** The period found, in samples; 0 when nothing repeats. */
  lag: number;
}

/**
 * How strongly `window` repeats at a lag in [minLag, maxLag], and at which.
 * Written into `into`, so the audio thread allocates nothing per hop.
 *
 * A signal that repeats every T also repeats every 2T, often almost as
 * strongly, so the shortest lag that comes close to the best is taken as the
 * period — the best alone would put a voice an octave low half the time.
 */
export function periodicity(
  window: Float32Array,
  minLag: number,
  maxLag: number,
  scores: Float32Array,
  into: Periodicity,
): Periodicity {
  let best = 0;
  const last = Math.min(maxLag, window.length - 1);
  for (let lag = minLag; lag <= last; lag++) {
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
    scores[lag] = r;
    if (r > best) best = r;
  }
  into.r = best;
  into.lag = 0;
  for (let lag = minLag; lag <= last; lag++) {
    const r = scores[lag] ?? 0;
    const isPeak = r >= (scores[lag - 1] ?? 0) && r >= (scores[lag + 1] ?? 0);
    if (r >= best * 0.9 && isPeak) {
      into.lag = lag;
      break;
    }
  }
  return into;
}

/** `voice` null judges any close, short voice a word — how calibration itself listens. */
export function createOnsetDetector(sampleRate: number, voice: VoiceProfile | null = null): OnsetDetector {
  const hopSamples = Math.max(1, Math.round((sampleRate * HOP_MS) / 1000));
  const warmUpHops = Math.ceil(WARM_UP_MS / HOP_MS);
  const endGapHops = Math.ceil(END_GAP_MS / HOP_MS);
  const maxHops = Math.ceil(VOICE_MAX_MS / HOP_MS);

  const highpass = biquad('highpass', LOW_CUT_HZ, sampleRate);
  const lowpass = biquad('lowpass', HIGH_CUT_HZ, sampleRate);

  const decimation = Math.max(1, Math.round(sampleRate / VOICING_RATE_HZ));
  const voicingRate = sampleRate / decimation;
  const ring = new Float32Array(Math.ceil((voicingRate * VOICING_WINDOW_MS) / 1000));
  const window = new Float32Array(ring.length);
  const minLag = Math.floor(voicingRate / PITCH_MAX_HZ);
  const maxLag = Math.min(Math.ceil(voicingRate / PITCH_MIN_HZ), Math.floor(ring.length / 2));
  const scores = new Float32Array(maxLag + 2);
  const found: Periodicity = { r: 0, lag: 0 };
  let ringAt = 0;
  /*
   * Periodicity only shows once the vowel fills enough of the window, so a
   * hop is first found voiced about this long after the voice began — and
   * that is where the onset is dated back to.
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
  let floorDb = -100;
  let gateDb = MIN_LEVEL_DB;

  /*
   * 'quiet': waiting for a voiced hop. 'sound': gathering one. 'overlong': a
   * sound already too long to be the word, waited out without being gathered.
   */
  let phase: 'quiet' | 'sound' | 'overlong' = 'quiet';
  let soundStart = 0;
  let hopsSinceStart = 0;
  let lastVoicedHop = 0;
  let gapHops = 0;
  let voicedHops = 0;
  let periodicitySum = 0;
  let loudestDb = -Infinity;
  let peakLevelDb = -Infinity;
  const repeatSamples = Math.round((sampleRate * REPEAT_MS) / 1000);
  let lastVoiceAt = -Infinity;
  // One pitch per voiced hop of the sound; a sound past VOICE_MAX_MS is not gathered.
  const pitches = new Float32Array(maxHops + endGapHops + 1);

  function floorOfRoom(): number {
    // Sorted in place: a percentile of a copy, with nothing allocated.
    const count = levelCount;
    for (let i = 0; i < count; i++) sorted[i] = levels[i] ?? 0;
    const view = sorted.subarray(0, count);
    view.sort();
    return view[Math.floor((count - 1) * FLOOR_PERCENTILE)] ?? -100;
  }

  /** Voiced this hop? Leaves the periodicity it measured in `found`. */
  function measureHop(): boolean {
    found.r = 0;
    found.lag = 0;
    if (levelDb < gateDb) return false;
    // Oldest sample first, the way the autocorrelation reads it.
    for (let i = 0; i < ring.length; i++) window[i] = ring[(ringAt + i) % ring.length] ?? 0;
    periodicity(window, minLag, maxLag, scores, found);
    return found.r >= VOICED && found.lag > 0;
  }

  function gather(): void {
    pitches[voicedHops] = voicingRate / found.lag;
    voicedHops++;
    periodicitySum += found.r;
    peakLevelDb = Math.max(peakLevelDb, levelDb);
    loudestDb = Math.max(loudestDb, levelDb - floorDb);
    lastVoicedHop = hopsSinceStart;
  }

  /** Voiced, and not yet the room ringing on after the sound itself. */
  function isPartOfSound(isVoiced: boolean): boolean {
    return isVoiced && levelDb >= peakLevelDb - SOUND_SPAN_DB;
  }

  /** The sound gathered so far, as it would be judged with this verdict and length. */
  function describe(verdict: Verdict, durationMs: number): Sound {
    const view = pitches.subarray(0, voicedHops);
    view.sort();
    const pitchHz = view[Math.floor((voicedHops - 1) / 2)] ?? 0;
    let steady = 0;
    for (let i = 0; i < voicedHops; i++) {
      if (Math.abs((view[i] ?? 0) - pitchHz) <= pitchHz * STEADY_SHARE) steady++;
    }
    return {
      at: soundStart,
      verdict,
      durationMs,
      periodicity: periodicitySum / Math.max(1, voicedHops),
      pitchHz,
      steadiness: steady / Math.max(1, voicedHops),
      loudnessDb: loudestDb,
    };
  }

  function judge(): Sound {
    const sound = describe('voice', (lastVoicedHop + 1) * HOP_MS);
    let verdict = judgeSound(sound, voice);
    if (verdict === 'voice') {
      if (soundStart - lastVoiceAt < repeatSamples) verdict = 'repeat';
      else lastVoiceAt = soundStart;
    }
    return { ...sound, verdict };
  }

  function endHop(): Sound | null {
    const meanSquare = hopSum / hopSamples;
    // Two hops, not one: a low voice's pitch period is longer than a hop, and
    // one hop alone flickers with where in the period it happened to fall.
    levelDb = toDb((meanSquare + previousHopMeanSquare) / 2);
    previousHopMeanSquare = meanSquare;

    if (levelDb > DIGITAL_SILENCE_DB) {
      levels[levelsAt] = levelDb;
      levelsAt = (levelsAt + 1) % levels.length;
      levelCount = Math.min(levelCount + 1, levels.length);
    }
    if (levelCount < warmUpHops) return null;
    floorDb = floorOfRoom();
    gateDb = Math.max(floorDb + GATE_DB, MIN_LEVEL_DB);

    const isVoiced = measureHop();

    switch (phase) {
      case 'quiet':
        if (!isVoiced) return null;
        phase = 'sound';
        soundStart = Math.max(0, position - voicingDelaySamples);
        hopsSinceStart = 0;
        gapHops = 0;
        voicedHops = 0;
        periodicitySum = 0;
        peakLevelDb = -Infinity;
        loudestDb = -Infinity;
        gather();
        return null;
      case 'sound':
        hopsSinceStart++;
        if (isPartOfSound(isVoiced)) {
          gapHops = 0;
          gather();
        } else if (++gapHops >= endGapHops) {
          // The gap that ended it was quiet enough to start the next one from.
          phase = 'quiet';
          return judge();
        }
        if (hopsSinceStart >= maxHops) {
          phase = 'overlong';
          gapHops = 0;
          return describe('long', hopsSinceStart * HOP_MS);
        }
        return null;
      case 'overlong':
        hopsSinceStart++;
        if (!isPartOfSound(isVoiced)) {
          gapHops++;
          if (gapHops >= endGapHops) phase = 'quiet';
        } else {
          gapHops = 0;
        }
        return null;
    }
  }

  return {
    push(samples) {
      let sounds: Sound[] | null = null;
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
          const sound = endHop();
          hopFill = 0;
          hopSum = 0;
          if (sound !== null) (sounds ??= []).push(sound);
        }
      }
      return sounds ?? NOTHING;
    },
    get levelDb() {
      return levelDb;
    },
    get gateDb() {
      return gateDb;
    },
  };
}
