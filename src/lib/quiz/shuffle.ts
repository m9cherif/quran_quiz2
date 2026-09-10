/**
 * Fisher-Yates shuffle — the JS replacement for `order by random()` in
 * save_ordering_question / save_page_words_question. `sort(() => Math.random()
 * - 0.5)` is biased (does not produce a uniform permutation); this does.
 * Returns a new array, leaves the input untouched.
 */
export function fisherYatesShuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
