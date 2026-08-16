/**
 * One way to write a phone number, shared by the browser and the server.
 *
 * The number is typed in a form, checked again in the route handler, sent to
 * Bird, and finally matched against the one Supabase stored. Four places, and
 * a number that survives three of them but not the fourth produces the worst
 * kind of bug: an SMS that arrives and a sign-in that still fails. So the
 * rules live here once, and every side imports them.
 *
 * This module deliberately imports nothing — it is pulled into a client bundle
 * and into a Node route alike.
 */

/** Where a number goes when it is typed without a country code. */
export const DEFAULT_COUNTRY_CODE = "+216";

/** E.164: a plus, a country code that cannot start with zero, then digits. */
const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Tunisian mobiles are eight digits starting with 2, 4, 5 or 9. The other
 * prefixes are landlines: an SMS sent there is paid for and never arrives, so
 * it is better to refuse here than to charge for silence.
 */
const TUNISIAN_MOBILE = /^\+216[2459]\d{7}$/;

/**
 * Turn whatever was typed into E.164, or return null if it cannot be one.
 *
 * People write numbers with spaces, dashes, brackets and a leading zero, and
 * "+216 12 345 678" is the same number as "+21612345678". Only the second form
 * is sent anywhere.
 */
export function normalizePhone(input: string): string | null {
  let digits = input.trim().replace(/[^\d+]/g, "");
  if (!/\d/.test(digits)) return null;

  // "00" is how much of the world writes "+", and reading it as digits turns
  // 0021612345678 into a number in no country at all.
  if (digits.startsWith("00")) digits = `+${digits.slice(2)}`;

  let value = digits.startsWith("+")
    ? digits
    : DEFAULT_COUNTRY_CODE + digits.replace(/^0+/, "");
  // A plus is only meaningful as the first character; one typed mid-number is
  // a slip, not a second country code.
  value = `+${value.slice(1).replace(/\+/g, "")}`;

  if (!E164.test(value)) return null;
  if (value.startsWith("+216") && !TUNISIAN_MOBILE.test(value)) return null;
  return value;
}

/**
 * The same number as Supabase keeps it: digits only, no plus.
 *
 * Supabase stores `auth.users.phone` without the leading plus ("21612345678"),
 * while Bird requires it. Nothing else in the app should have to remember
 * which side wants which.
 */
export function toSupabasePhone(e164: string): string {
  return e164.replace(/^\+/, "");
}

/**
 * A number reduced to its last three digits, for logs.
 *
 * A whole phone number in a log file is personal data that nobody reading the
 * log needs; three digits are enough to tell two testers apart.
 */
export function redactPhone(phone: string): string {
  return phone.length > 4 ? `…${phone.slice(-3)}` : "…";
}
