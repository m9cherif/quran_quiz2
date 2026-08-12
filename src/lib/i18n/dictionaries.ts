import en from "./messages/en";
import type { Locale, Messages } from "./types";

export type { Locale, Messages };
export { localeNames } from "./types";

/**
 * English ships inside the main bundle (it is the fallback every screen
 * renders with on first paint); Arabic and French are separate chunks that
 * load only when that locale is actually selected. Keeping all three inlined
 * put ~90 KB of translations into every page bundle.
 */
export const defaultLocale: Locale = "en";
export const defaultMessages: Messages = en;

const cache = new Map<Locale, Messages>([["en", en]]);

/** Resolve a locale dictionary, fetching (and caching) the chunk on demand. */
export async function loadMessages(locale: Locale): Promise<Messages> {
  const cached = cache.get(locale);
  if (cached) return cached;

  const loaded =
    locale === "ar"
      ? (await import("./messages/ar")).default
      : (await import("./messages/fr")).default;

  cache.set(locale, loaded);
  return loaded;
}

/** Synchronously read an already-loaded dictionary (used for the first paint). */
export function peekMessages(locale: Locale): Messages {
  return cache.get(locale) ?? en;
}
