/**
 * The shape a translation has to have: the English copy with every literal
 * widened to a plain string, so another language may say anything, but only
 * where English says something. A missing key, a key too many, or a function
 * given the wrong arguments is a build error rather than a hole somebody
 * notices on the phone.
 */
export type Translated<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => string
    ? (...args: A) => string
    : T[K] extends string
      ? string
      : Translated<T[K]>;
};
