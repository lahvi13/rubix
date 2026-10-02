import type { Face } from '../domain/cube/notation';

/**
 * The name, one letter to a sticker in the reader's own cube colours. Five
 * letters take five of the six faces; white sits out, as on a dark ground it
 * outshone the rest. Mixed rather than in rainbow order, like a row of a
 * scrambled cube, with no two near colours side by side.
 *
 * One list for every place the name is drawn this way — the share card and
 * the foot of the menu — so the two cannot drift apart.
 */
export const WORDMARK: readonly { letter: string; face: Face }[] = [
  { letter: 'R', face: 'L' },
  { letter: 'U', face: 'F' },
  { letter: 'B', face: 'U' },
  { letter: 'I', face: 'R' },
  { letter: 'X', face: 'B' },
];
