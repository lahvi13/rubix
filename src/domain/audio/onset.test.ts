import { describe, expect, it } from 'vitest';
import {
  calibrateVoice,
  calibrationProgress,
  createOnsetDetector,
  judgeSound,
  periodicity,
  type Sound,
  type Verdict,
  type VoiceProfile,
} from './onset';

const RATE = 48_000;

/** Deterministic noise, so a failing case fails the same way every run. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32 - 0.5;
  };
}

function samples(ms: number, rate = RATE): Float32Array {
  return new Float32Array(Math.round((rate * ms) / 1000));
}

function at(ms: number, rate = RATE): number {
  return Math.round((rate * ms) / 1000);
}

/** Adds white noise over [fromMs, toMs). */
function noise(signal: Float32Array, fromMs: number, toMs: number, amplitude: number, seed = 1, rate = RATE) {
  const next = random(seed);
  for (let i = at(fromMs, rate); i < Math.min(at(toMs, rate), signal.length); i++) {
    signal[i] = (signal[i] ?? 0) + 2 * amplitude * next();
  }
}

/** A vowel: a pitch and its harmonics, faded in and out so it has no edges of its own. */
function vowel(signal: Float32Array, fromMs: number, lengthMs: number, amplitude: number, pitchHz = 150, rate = RATE) {
  const start = at(fromMs, rate);
  const length = at(lengthMs, rate);
  const ramp = at(10, rate);
  for (let i = 0; i < length && start + i < signal.length; i++) {
    const envelope = Math.min(1, i / ramp, (length - i) / ramp);
    let value = 0;
    for (let harmonic = 1; harmonic <= 6; harmonic++) {
      value += Math.sin((2 * Math.PI * pitchHz * harmonic * i) / rate) / harmonic;
    }
    signal[start + i] = (signal[start + i] ?? 0) + amplitude * envelope * value;
  }
}

/** A layer turning: a sharp crack that dies away in a couple of milliseconds. */
function click(signal: Float32Array, atMs: number, amplitude: number, seed: number) {
  const next = random(seed);
  const start = at(atMs);
  for (let i = 0; i < at(10) && start + i < signal.length; i++) {
    signal[start + i] = (signal[start + i] ?? 0) + 2 * amplitude * next() * Math.exp(-i / at(2));
  }
}

/** Every sound judged, with its start in ms. */
function sounds(
  signal: Float32Array,
  block = 128,
  rate = RATE,
  voice: VoiceProfile | null = null,
): (Sound & { atMs: number })[] {
  const detector = createOnsetDetector(rate, voice);
  const heard: (Sound & { atMs: number })[] = [];
  for (let offset = 0; offset < signal.length; offset += block) {
    for (const sound of detector.push(signal.subarray(offset, offset + block))) {
      heard.push({ ...sound, atMs: (sound.at / rate) * 1000 });
    }
  }
  return heard;
}

/** Where each sound taken for the word began, in ms. */
function detect(signal: Float32Array, block = 128, rate = RATE): number[] {
  return sounds(signal, block, rate)
    .filter((sound) => sound.verdict === 'voice')
    .map((sound) => sound.atMs);
}

/** How far off the date of a vowel's start may be; a tap is no closer than this either. */
function expectNear(onsetMs: number | undefined, startMs: number) {
  expect(onsetMs).toBeGreaterThanOrEqual(startMs - 10);
  expect(onsetMs).toBeLessThanOrEqual(startMs + 10);
}

/** A quiet room: every case starts from it. */
function room(ms: number, rate = RATE): Float32Array {
  const signal = samples(ms, rate);
  noise(signal, 0, ms, 0.001, 99, rate);
  return signal;
}

describe('createOnsetDetector', () => {
  it('hears nothing in a quiet room', () => {
    expect(sounds(room(3000))).toEqual([]);
  });

  it('dates a word back to where it began', () => {
    const signal = room(2000);
    vowel(signal, 1000, 150, 0.1);
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 1000);
  });

  it('says what it judged the word on', () => {
    const signal = room(2000);
    vowel(signal, 1000, 150, 0.1, 180);
    const [word] = sounds(signal);
    expect(word?.durationMs).toBeGreaterThanOrEqual(120);
    expect(word?.durationMs).toBeLessThanOrEqual(170);
    expect(word?.periodicity).toBeGreaterThan(0.9);
    expect(word?.pitchHz).toBeGreaterThan(170);
    expect(word?.pitchHz).toBeLessThan(190);
    expect(word?.steadiness).toBeGreaterThan(0.9);
    expect(word?.loudnessDb).toBeGreaterThan(30);
  });

  it.each([
    ['a low voice', 90],
    ['a high voice', 280],
  ])('hears %s', (_, pitchHz) => {
    const signal = room(2000);
    vowel(signal, 1000, 150, 0.1, pitchHz);
    expect(detect(signal)).toHaveLength(1);
  });

  it('takes turning clicks for nothing, however loud', () => {
    const signal = room(3000);
    for (let ms = 500; ms < 2800; ms += 80) click(signal, ms, 0.4, ms);
    expect(detect(signal)).toEqual([]);
  });

  it('takes a sound that holds but does not repeat for nothing', () => {
    const signal = room(2000);
    noise(signal, 1000, 1300, 0.1, 7);
    expect(detect(signal)).toEqual([]);
  });

  it('turns away a tone that goes on far longer than a word', () => {
    const signal = room(3000);
    vowel(signal, 1000, 800, 0.1);
    const heard = sounds(signal);
    expect(heard.map((sound) => sound.verdict)).toEqual(['long']);
    // Turned away for its length, but still described: the log is for tuning.
    expect(heard[0]?.pitchHz).toBeCloseTo(150, -1);
  });

  it('turns away running speech in the background', () => {
    const signal = room(4000);
    for (let ms = 1000; ms < 2800; ms += 230) vowel(signal, ms, 150, 0.1, 130 + (ms % 40));
    expect(detect(signal)).toEqual([]);
  });

  it('turns away a voice from across the room', () => {
    const signal = room(4000);
    noise(signal, 0, 4000, 0.02, 4);
    // Periodic, but only about 11 dB above the room — which also leaves it
    // voiced only in patches, so which reason is given varies.
    vowel(signal, 2000, 150, 0.004);
    expect(detect(signal)).toEqual([]);
  });

  it('hears two words as two', () => {
    const signal = room(2500);
    vowel(signal, 800, 150, 0.1);
    vowel(signal, 1600, 150, 0.1);
    expect(detect(signal)).toHaveLength(2);
  });

  it('hears a word said close to the phone without the room ringing on after it', () => {
    const signal = room(3000);
    vowel(signal, 1000, 150, 0.3);
    // The echo: the same pitch, starting well below the word and dying away
    // over most of a second — far above the floor for all of that time.
    const start = at(1150);
    for (let i = 0; i < at(800); i++) {
      let value = 0;
      for (let harmonic = 1; harmonic <= 6; harmonic++) {
        value += Math.sin((2 * Math.PI * 150 * harmonic * i) / RATE) / harmonic;
      }
      signal[start + i] = (signal[start + i] ?? 0) + 0.06 * Math.exp(-i / at(150)) * value;
    }
    const heard = sounds(signal);
    expect(heard[0]?.verdict).toBe('voice');
    expect(heard[0]?.durationMs).toBeLessThan(400);
    expectNear(heard[0]?.atMs, 1000);
    // Whatever of the echo is judged on its own is not a second word.
    expect(heard.slice(1).every((sound) => sound.verdict !== 'voice')).toBe(true);
  });

  it('judges nothing before it has heard the room', () => {
    const signal = room(2000);
    vowel(signal, 100, 150, 0.1);
    vowel(signal, 1000, 150, 0.1);
    const heard = sounds(signal);
    expect(heard).toHaveLength(1);
    expectNear(heard[0]?.atMs, 1000);
  });

  it('does not take a microphone still handing over zeros for a silent room', () => {
    const waking = samples(3000);
    waking.set(room(2000), 1000 * 48);
    vowel(waking, 2000, 150, 0.1);
    const awake = room(2000);
    vowel(awake, 1000, 150, 0.1);
    const [late] = sounds(waking);
    const [usual] = sounds(awake);
    expect(late?.verdict).toBe('voice');
    expect(Math.abs((late?.loudnessDb ?? 0) - (usual?.loudnessDb ?? 0))).toBeLessThan(3);
  });

  it('calibrated, takes only the solver', () => {
    const signal = room(4000);
    vowel(signal, 1000, 150, 0.1, 150);
    vowel(signal, 2500, 150, 0.1, 300);
    const solver: VoiceProfile = { loudnessDb: 57, pitchHz: 150 };
    expect(sounds(signal, 128, RATE, solver).map((sound) => sound.verdict)).toEqual(['voice', 'pitch']);
  });

  it('hears an emphatic "hop", its p released after a long hold, as one word', () => {
    const signal = room(2000);
    vowel(signal, 1000, 150, 0.1);
    // The breath of voice after the p, past the gap that ends a sound.
    vowel(signal, 1330, 80, 0.08);
    const heard = sounds(signal);
    expect(heard.map((sound) => sound.verdict)).toEqual(['voice', 'repeat']);
    expectNear(heard[0]?.atMs, 1000);
  });

  it('hears two syllables of one word as one', () => {
    const signal = room(2000);
    vowel(signal, 1000, 120, 0.1);
    vowel(signal, 1180, 120, 0.1);
    expect(detect(signal)).toHaveLength(1);
  });

  it('hears a word said in the middle of turning', () => {
    const signal = room(4000);
    noise(signal, 1000, 3000, 0.02, 3);
    for (let ms = 1000; ms < 3000; ms += 90) click(signal, ms, 0.3, ms);
    vowel(signal, 2000, 150, 0.1);
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 2000);
  });

  it('is not left deaf behind a rattle that never stops', () => {
    const signal = room(6000);
    noise(signal, 500, 6000, 0.02, 3);
    for (let ms = 500; ms < 6000; ms += 90) click(signal, ms, 0.3, ms);
    vowel(signal, 4500, 150, 0.2);
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 4500);
  });

  it('decides the same however the stream is cut into blocks', () => {
    const signal = room(2500);
    vowel(signal, 700, 150, 0.1);
    noise(signal, 1300, 1500, 0.1, 5);
    vowel(signal, 2000, 150, 0.1);
    expect(sounds(signal, 441)).toEqual(sounds(signal, 128));
  });

  it('works at 44.1 kHz too', () => {
    const rate = 44_100;
    const signal = room(2000, rate);
    vowel(signal, 1000, 150, 0.1, 150, rate);
    const onsets = detect(signal, 128, rate);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 1000);
  });

  it('reports a level above the gate while somebody speaks', () => {
    const detector = createOnsetDetector(RATE);
    detector.push(room(1000));
    const quiet = detector.levelDb;
    expect(quiet).toBeLessThan(detector.gateDb);
    const signal = samples(100);
    vowel(signal, 0, 100, 0.1);
    detector.push(signal);
    expect(detector.levelDb).toBeGreaterThan(quiet + 30);
    expect(detector.levelDb).toBeGreaterThan(detector.gateDb);
  });
});

describe('judgeSound', () => {
  it.each<[string, number, number, number, Verdict]>([
    ['a clear, close word', 150, 0.9, 40, 'voice'],
    ['the shortest word taken', 60, 0.9, 40, 'voice'],
    ['the longest word taken', 600, 0.9, 40, 'voice'],
    ['the quietest word taken', 150, 0.9, 30, 'voice'],
    ['the least periodic word taken', 150, 0.55, 40, 'voice'],
    ['a blip', 55, 0.9, 40, 'short'],
    ['speech that runs on', 605, 0.9, 40, 'long'],
    // The loudest of everything but the words in the first test on a phone was 18 dB.
    ['a clink across the room', 150, 0.9, 18, 'quiet'],
    ['just under the line', 150, 0.9, 29, 'quiet'],
    ['a squeak that repeats only in patches', 150, 0.5, 40, 'unclear'],
    ['too long outranks the rest', 900, 0.3, 5, 'long'],
    ['too quiet outranks unclear', 150, 0.3, 5, 'quiet'],
  ])('%s', (_, durationMs, periodicityScore, loudnessDb, verdict) => {
    expect(judgeSound({ durationMs, periodicity: periodicityScore, pitchHz: 110, loudnessDb }, null)).toBe(
      verdict,
    );
  });

  // The solver of the tests on a phone: "hop" at about 110 Hz, 65 dB above the room.
  const SOLVER: VoiceProfile = { loudnessDb: 65, pitchHz: 110 };

  it.each<[string, number, number, Verdict]>([
    ['their own "hop"', 110, 65, 'voice'],
    ['a little lower and softer', 90, 52, 'voice'],
    ['emphatic, and higher for it', 140, 70, 'voice'],
    // What slipped through uncalibrated, taking the place of the next real word.
    ['a stray at 308 Hz', 308, 39, 'quiet'],
    ['a stray at their pitch, 30 dB down', 111, 33, 'quiet'],
    ['somebody else, as loud as they are', 220, 65, 'pitch'],
    ['a hum far below them', 60, 65, 'pitch'],
  ])('calibrated: %s', (_, pitchHz, loudnessDb, verdict) => {
    expect(judgeSound({ durationMs: 200, periodicity: 0.8, pitchHz, loudnessDb }, SOLVER)).toBe(verdict);
  });

  it('never asks less loudness of a calibrated word than of any word', () => {
    const quietSolver: VoiceProfile = { loudnessDb: 35, pitchHz: 110 };
    expect(
      judgeSound({ durationMs: 200, periodicity: 0.8, pitchHz: 110, loudnessDb: 25 }, quietSolver),
    ).toBe('quiet');
  });
});

describe('calibrateVoice', () => {
  function word(pitchHz: number, loudnessDb: number, verdict: Verdict = 'voice') {
    return { verdict, pitchHz, loudnessDb };
  }

  // The second five-"hop" test on a phone, in the order it was heard.
  const TEST = [
    word(200, 53),
    word(151, 77, 'repeat'),
    word(222, 59),
    word(205, 51, 'unclear'),
    word(114, 65),
    word(250, 35),
    word(116, 65, 'repeat'),
    word(320, 34),
    word(105, 66, 'repeat'),
    word(105, 33),
    word(104, 65),
    word(258, 33, 'repeat'),
    word(104, 65),
    word(258, 30, 'repeat'),
  ];

  it('finds the five words alike among the strays', () => {
    expect(calibrateVoice(TEST)).toEqual({ loudnessDb: 65, pitchHz: 105 });
    expect(calibrationProgress(TEST)).toBe(5);
  });

  it('waits until five alike words have been heard', () => {
    const early = TEST.slice(0, 10);
    expect(calibrateVoice(early)).toBeNull();
    expect(calibrationProgress(early)).toBe(3);
  });

  it('takes the louder of two groups as large as each other', () => {
    const quiet = Array.from({ length: 5 }, () => word(220, 35));
    const loud = Array.from({ length: 5 }, () => word(110, 60));
    expect(calibrateVoice([...quiet, ...loud])).toEqual({ loudnessDb: 60, pitchHz: 110 });
  });

  it('ignores what was not a word at all', () => {
    const noise = Array.from({ length: 6 }, () => word(110, 60, 'quiet'));
    expect(calibrateVoice(noise)).toBeNull();
  });
});

describe('periodicity', () => {
  function measure(source: (i: number) => number) {
    const window = new Float32Array(320);
    for (let i = 0; i < window.length; i++) window[i] = source(i);
    return periodicity(window, 20, 114, new Float32Array(116), { r: 0, lag: 0 });
  }

  it('finds a tone and its period, not twice its period', () => {
    // 8 kHz / 50 samples = 160 Hz, whose double (100 samples) is also in range.
    const found = measure((i) => Math.sin((2 * Math.PI * i) / 50) + 0.5 * Math.sin((4 * Math.PI * i) / 50));
    expect(found.r).toBeGreaterThan(0.9);
    expect(found.lag).toBe(50);
  });

  it.each<[string, (i: number) => number]>([
    ['noise', (() => {
      const next = random(11);
      return () => next();
    })()],
    ['silence', () => 0],
  ])('finds little in %s', (_, source) => {
    expect(measure(source).r).toBeLessThan(0.3);
  });
});
