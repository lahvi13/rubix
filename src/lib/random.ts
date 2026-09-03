/**
 * Randomness the way time works in clock.ts: the domain never reaches for a
 * global, it takes a source as a parameter, and a test hands it a sequence it
 * chose itself.
 */

/** A number in [0, 1), the shape Math.random has. */
export type Random = () => number;

export const systemRandom: Random = () => Math.random();
