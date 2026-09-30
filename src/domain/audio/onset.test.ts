import { describe, expect, it } from 'vitest';
import { createOnsetDetector, periodicity } from './onset';

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

/** Where each voice heard began, in ms. */
function detect(signal: Float32Array, block = 128, rate = RATE): number[] {
  const detector = createOnsetDetector(rate);
  const onsets: number[] = [];
  for (let offset = 0; offset < signal.length; offset += block) {
    for (const at of detector.push(signal.subarray(offset, offset + block))) {
      onsets.push((at / rate) * 1000);
    }
  }
  return onsets;
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
    expect(detect(room(3000))).toEqual([]);
  });

  it('dates a word back to where it began', () => {
    const signal = room(2000);
    vowel(signal, 1000, 150, 0.1);
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 1000);
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

  it('hears a word said in the middle of turning', () => {
    const signal = room(4000);
    noise(signal, 1000, 3000, 0.02, 3);
    for (let ms = 1000; ms < 3000; ms += 90) click(signal, ms, 0.3, ms);
    vowel(signal, 2000, 150, 0.1);
    const onsets = detect(signal);
    expect(onsets).toHaveLength(1);
    expectNear(onsets[0], 2000);
  });

  it('hears two words as two', () => {
    const signal = room(2500);
    vowel(signal, 800, 150, 0.1);
    vowel(signal, 1400, 150, 0.1);
    expect(detect(signal)).toHaveLength(2);
  });

  it('hears two syllables of one word as one', () => {
    const signal = room(2000);
    vowel(signal, 1000, 120, 0.1);
    vowel(signal, 1180, 120, 0.1);
    expect(detect(signal)).toHaveLength(1);
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
    expect(detect(signal, 441)).toEqual(detect(signal, 128));
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

describe('periodicity', () => {
  it.each<[string, (i: number) => number, number, number]>([
    ['a tone at a pitch in range', (i) => Math.sin((2 * Math.PI * i) / 60), 0.9, 1.01],
    ['noise', (() => {
      const next = random(11);
      return () => next();
    })(), 0, 0.3],
    ['silence', () => 0, 0, 0.01],
  ])('%s', (_, source, low, high) => {
    const window = new Float32Array(600);
    for (let i = 0; i < window.length; i++) window[i] = source(i);
    const value = periodicity(window, 30, 172);
    expect(value).toBeGreaterThanOrEqual(low);
    expect(value).toBeLessThanOrEqual(high);
  });
});
