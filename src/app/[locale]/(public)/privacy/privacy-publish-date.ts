/**
 * Date shown on both privacy policies as the effective date and the last-updated date.
 */
export const PRIVACY_PUBLISH_DATE = "3 October 2026";

const UK_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Day, full English month name, four-digit year. No leading zero on the day. */
const UK_LONG_FORM_DATE = new RegExp(
  `^([1-9]|[12]\\d|3[01]) (${UK_MONTHS.join("|")}) (\\d{4})$`
);

/**
 * True only for a real calendar date written as `1 October 2026`.
 * Rejects placeholders, empty strings, ISO dates, and impossible days.
 */
export function isUkLongFormDate(value: string): boolean {
  const match = UK_LONG_FORM_DATE.exec(value);
  if (!match) return false;

  const day = Number(match[1]);
  const month = UK_MONTHS.indexOf(match[2] as (typeof UK_MONTHS)[number]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month &&
    parsed.getUTCDate() === day
  );
}
