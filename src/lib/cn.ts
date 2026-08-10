/**
 * Join class names, discarding falsy values.
 * Accepts strings, arrays, and nested arrays of strings.
 */
export function cn(...classes: Array<string | false | null | undefined | Array<string | false | null | undefined>>): string {
  return classes.flat(Infinity).filter(Boolean).join(" ");
}

export default cn;