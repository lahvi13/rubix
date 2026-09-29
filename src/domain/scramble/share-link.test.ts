import { describe, expect, it } from 'vitest';
import { readShareLink, shareLinkFor, type SharedScramble } from './share-link';

const ORIGIN = 'https://rubix.lahvi.cz';

describe('shareLinkFor', () => {
  it.each<[string, SharedScramble, string | null]>([
    [
      'a scramble and a time',
      { scramble: "R U R' F2", targetMs: 14370 },
      `${ORIGIN}/#/timer?scramble=R_U_R-_F2&beat=14370`,
    ],
    ['a DNF, with nothing to beat', { scramble: "R U'", targetMs: null }, `${ORIGIN}/#/timer?scramble=R_U-`],
    ['wide moves the short way', { scramble: "Rw U' r2", targetMs: null }, `${ORIGIN}/#/timer?scramble=r_U-_r2`],
    ['brackets dropped', { scramble: "(R U) R'", targetMs: null }, `${ORIGIN}/#/timer?scramble=R_U_R-`],
    ['no link for a scramble that does not parse', { scramble: 'R Q', targetMs: 1000 }, null],
    ['no link for an empty one', { scramble: '  ', targetMs: 1000 }, null],
  ])('writes %s', (_name, shared, link) => {
    expect(shareLinkFor(ORIGIN, shared)).toBe(link);
  });
});

describe('readShareLink', () => {
  it.each<[string, string, SharedScramble | null]>([
    ['its own links', '#/timer?scramble=R_U_R-_F2&beat=14370', { scramble: "R U R' F2", targetMs: 14370 }],
    ['one without a time', '#/timer?scramble=R_U-', { scramble: "R U'", targetMs: null }],
    ['spaces and primes escaped', "#/timer?scramble=R+U%27+F2", { scramble: "R U' F2", targetMs: null }],
    ['a hash without the slash', '#timer?scramble=R', { scramble: 'R', targetMs: null }],
    ['a scramble whatever the time is', '#/timer?scramble=R&beat=fast', { scramble: 'R', targetMs: null }],
    ['a fraction as no time', '#/timer?scramble=R&beat=14.37', { scramble: 'R', targetMs: null }],
    ['zero as no time', '#/timer?scramble=R&beat=0', { scramble: 'R', targetMs: null }],
    ['more than a day as no time', '#/timer?scramble=R&beat=90000000', { scramble: 'R', targetMs: null }],
    ['nothing from a plain route', '#/timer', null],
    ['nothing from another screen', '#/stats?scramble=R', null],
    ['nothing from moves that are not moves', '#/timer?scramble=R_Q', null],
    ['nothing from an empty scramble', '#/timer?scramble=&beat=1000', null],
    ['nothing from a scramble too long to be one', `#/timer?scramble=${Array(101).fill('R').join('_')}`, null],
  ])('reads %s', (_name, hash, shared) => {
    expect(readShareLink(hash)).toEqual(shared);
  });

  it('reads back what it writes', () => {
    const shared = { scramble: "U2 L2 D B2 U' R2 U' L2 B2 U B2 F2 R' D B' D' L' F' R B R", targetMs: 9870 };
    const link = shareLinkFor(ORIGIN, shared) ?? '';

    expect(readShareLink(new URL(link).hash)).toEqual(shared);
  });
});
