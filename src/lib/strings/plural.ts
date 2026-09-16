/**
 * Czech counts three ways where English counts two: one solve, two to four
 * solves, five solves. Which of the three a number takes is `Intl.PluralRules`'
 * job — the rule is not simply "ends in 2, 3 or 4", and nothing here should be
 * re-deriving it.
 */

const RULES = new Intl.PluralRules('cs');

/**
 * The form the count takes. Given without the number, because the number is
 * not always in front of the word — sometimes what agrees with it is a verb
 * further along the sentence.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  switch (RULES.select(count)) {
    case 'one':
      return one;
    case 'few':
      return few;
    // 'many' in Czech is the decimal form ("1,5 sekundy"); counts of things
    // reach here as 'other', and both take the same word.
    default:
      return many;
  }
}
