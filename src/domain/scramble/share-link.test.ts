import { describe, expect, it } from 'vitest';
import { readShareLink, shareLinkFor, type SharedScrambles } from './share-link';

const ORIGIN = 'https://rubix.lahvi.cz';
const FIVE = ["R U'", 'F2 D', "L' B", 'U2 R2', "D' F"];

describe('shareLinkFor', () => {
  it.each<[string, SharedScrambles, string | null]>([
    [
      'a scramble and a time',
      { scrambles: ["R U R' F2"], targetMs: 14370 },
      `${ORIGIN}/#/timer?scramble=R_U_R-_F2&beat=14370`,
    ],
    ['a DNF, with nothing to beat', { scrambles: ["R U'"], targetMs: null }, `${ORIGIN}/#/timer?scramble=R_U-`],
    ['wide moves the short way', { scrambles: ["Rw U' r2"], targetMs: null }, `${ORIGIN}/#/timer?scramble=r_U-_r2`],
    ['brackets dropped', { scrambles: ["(R U) R'"], targetMs: null }, `${ORIGIN}/#/timer?scramble=R_U_R-`],
    [
      'an ao5, every scramble in order',
      { scrambles: FIVE, targetMs: 12_340 },
      `${ORIGIN}/#/timer?scramble=R_U-&scramble=F2_D&scramble=L-_B&scramble=U2_R2&scramble=D-_F&beat=12340`,
    ],
    ['no link for a scramble that does not parse', { scrambles: ['R Q'], targetMs: 1000 }, null],
    ['no link for an empty one', { scrambles: ['  '], targetMs: 1000 }, null],
    ['no link when one of five does not parse', { scrambles: [...FIVE.slice(0, 4), 'Q'], targetMs: 1000 }, null],
    ['no link for a count that is no average', { scrambles: FIVE.slice(0, 3), targetMs: 1000 }, null],
    ['no link for no scrambles', { scrambles: [], targetMs: 1000 }, null],
  ])('writes %s', (_name, shared, link) => {
    expect(shareLinkFor(ORIGIN, shared)).toBe(link);
  });
});

describe('readShareLink', () => {
  it.each<[string, string, SharedScrambles | null]>([
    ['its own links', '#/timer?scramble=R_U_R-_F2&beat=14370', { scrambles: ["R U R' F2"], targetMs: 14370 }],
    ['one without a time', '#/timer?scramble=R_U-', { scrambles: ["R U'"], targetMs: null }],
    ['spaces and primes escaped', '#/timer?scramble=R+U%27+F2', { scrambles: ["R U' F2"], targetMs: null }],
    ['a hash without the slash', '#timer?scramble=R', { scrambles: ['R'], targetMs: null }],
    ['scrambles whatever the time is', '#/timer?scramble=R&beat=fast', { scrambles: ['R'], targetMs: null }],
    ['a fraction as no time', '#/timer?scramble=R&beat=14.37', { scrambles: ['R'], targetMs: null }],
    ['zero as no time', '#/timer?scramble=R&beat=0', { scrambles: ['R'], targetMs: null }],
    ['more than a day as no time', '#/timer?scramble=R&beat=90000000', { scrambles: ['R'], targetMs: null }],
    [
      'an ao5 in order',
      '#/timer?scramble=R_U-&scramble=F2_D&scramble=L-_B&scramble=U2_R2&scramble=D-_F&beat=12340',
      { scrambles: FIVE, targetMs: 12_340 },
    ],
    ['nothing from a plain route', '#/timer', null],
    ['nothing from another screen', '#/stats?scramble=R', null],
    ['nothing from moves that are not moves', '#/timer?scramble=R_Q', null],
    ['nothing from an empty scramble', '#/timer?scramble=&beat=1000', null],
    ['nothing from a scramble too long to be one', `#/timer?scramble=${Array(101).fill('R').join('_')}`, null],
    ['nothing from three scrambles, which is no average', '#/timer?scramble=R&scramble=U&scramble=F', null],
    [
      'nothing from five when one does not parse',
      '#/timer?scramble=R&scramble=U&scramble=Q&scramble=F&scramble=D',
      null,
    ],
  ])('reads %s', (_name, hash, shared) => {
    expect(readShareLink(hash)).toEqual(shared);
  });

  it.each<[string, SharedScrambles]>([
    ['a single', { scrambles: ["U2 L2 D B2 U' R2 U' L2 B2 U B2 F2 R' D B' D' L' F' R B R"], targetMs: 9870 }],
    ['an ao12', { scrambles: [...FIVE, ...FIVE, "R U'", 'F2 D'], targetMs: 11_005 }],
  ])('reads back what it writes: %s', (_name, shared) => {
    const link = shareLinkFor(ORIGIN, shared) ?? '';

    expect(readShareLink(new URL(link).hash)).toEqual(shared);
  });
});
