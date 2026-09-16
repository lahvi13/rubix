/**
 * The translation is read on the phone, not here — what a test can hold is the
 * part a reader would only notice as a mistake: an entry left empty, and the
 * sentences whose wording changes with the count.
 */

import { describe, expect, it } from 'vitest';
import { cs } from './cs';
import { en } from './en';

type Node = string | ((...args: never[]) => string) | { [key: string]: Node };

function leaves(node: Node, path: string[] = []): [string, Node][] {
  if (typeof node === 'string' || typeof node === 'function') return [[path.join('.'), node]];
  return Object.entries(node).flatMap(([key, child]) => leaves(child, [...path, key]));
}

describe('the Czech copy', () => {
  it('leaves nothing blank', () => {
    const blank = leaves(cs as Node)
      .filter(([, value]) => typeof value === 'string' && value.trim() === '')
      .map(([path]) => path);
    expect(blank).toEqual([]);
  });

  /* The shape is the compiler's job; this only catches a branch of the
     English object that was copied across without being looked at. */
  it('has an entry for every English one', () => {
    expect(leaves(cs as Node).map(([path]) => path)).toEqual(
      leaves(en as Node).map(([path]) => path),
    );
  });
});

describe('counted sentences', () => {
  it.each([
    [1, 'Složení smazáno.'],
    [2, '2 složení smazána.'],
    [4, '4 složení smazána.'],
    [5, '5 složení smazáno.'],
    [22, '22 složení smazáno.'],
  ])('%i deleted solves', (count, expected) => {
    expect(cs.undo.deleted(count)).toBe(expected);
  });

  it.each([
    [1, '1 den'],
    [3, '3 dny'],
    [7, '7 dní'],
  ])('%i days of practice', (count, expected) => {
    expect(cs.stats.dayCount(count)).toBe(expected);
  });

  it.each([
    [0, 'nic neselhalo'],
    [1, 'zaznamenána 1 chyba'],
    [3, 'zaznamenány 3 chyby'],
    [8, 'zaznamenáno 8 chyb'],
  ])('%i failures', (count, expected) => {
    expect(cs.diagnostics.failures(count)).toBe(expected);
  });

  it.each([
    [1, 'Přeskočen 1 řádek'],
    [2, 'Přeskočeny 2 řádky'],
    [9, 'Přeskočeno 9 řádků'],
  ])('%i skipped csTimer rows', (count, expected) => {
    expect(cs.cstimer.skippedRows(count)).toBe(expected);
  });

  it.each([
    [0, 'Od té doby se nic nezměnilo.'],
    [1, 'Od té doby přibylo nebo se změnilo 1 složení.'],
    [3, 'Od té doby přibyla nebo se změnila 3 složení.'],
    [6, 'Od té doby přibylo nebo se změnilo 6 složení.'],
  ])('%i solves changed since the backup', (count, expected) => {
    expect(cs.data.changedSince(count)).toBe(expected);
  });
it.each([
    [1, '1 tah'],
    [3, '3 tahy'],
    [8, '8 tahů'],
  ])('%i cross moves', (count, expected) => {
    expect(cs.drill.crossMoves(count)).toBe(expected);
  });

  /* ao50 hands this a trim of 2, which is the form that was wrong. */
  it.each([
    [1, 'Nejrychlejší a nejpomalejší složení se škrtají (v závorce); průměr je ze zbytku.'],
    [2, '2 nejrychlejší a 2 nejpomalejší složení se škrtají (v závorce); průměr je ze zbytku.'],
    [5, '5 nejrychlejších a 5 nejpomalejších složení se škrtá (v závorce); průměr je ze zbytku.'],
  ])('a trim of %i', (trim, expected) => {
    expect(cs.stats.windowTrimNote(trim)).toBe(expected);
  });

  it.each([
    [1, '1 složení není v tvé poslední záloze.'],
    [3, '3 složení nejsou v tvé poslední záloze.'],
    [9, '9 složení není v tvé poslední záloze.'],
  ])('%i solves missing from the backup', (count, expected) => {
    expect(cs.backupReminder.sinceBackup(count)).toBe(expected);
  });

  it.each([
    [1, '1 složení importováno z csTimeru.'],
    [4, '4 složení importována z csTimeru.'],
    [6, '6 složení importováno z csTimeru.'],
  ])('%i solves imported', (count, expected) => {
    expect(cs.cstimer.imported(count)).toBe(expected);
  });
});
