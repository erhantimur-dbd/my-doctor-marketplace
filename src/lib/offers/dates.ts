const LONDON = "Europe/London";

function partsInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hourCycle: "h23",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    weekday: get("weekday"),
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Saturday 26 September 2026 — Europe/London, no comma. */
export function formatOfferDate(date: Date, timeZone = LONDON): string {
  const part = partsInZone(date, timeZone);
  return `${part.weekday} ${part.day} ${part.month} ${part.year}`;
}

/**
 * 23:59:59.999 on the given calendar date in Europe/London.
 * `isoDate` is YYYY-MM-DD.
 */
export function endOfLondonDay(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const utcGuess = new Date(`${isoDate}T23:59:59.999Z`);
  if (Number.isNaN(utcGuess.getTime())) return null;
  const shown = partsInZone(utcGuess, LONDON);
  const shownAsUtc = Date.UTC(
    Number(shown.year),
    monthIndex(shown.month),
    Number(shown.day),
    Number(shown.hour),
    Number(shown.minute),
    Number(shown.second),
    999
  );
  const offset = shownAsUtc - utcGuess.getTime();
  const zoned = new Date(utcGuess.getTime() - offset);
  const check = partsInZone(zoned, LONDON);
  const [year, month, day] = isoDate.split("-");
  if (
    check.year !== year ||
    String(monthIndex(check.month) + 1).padStart(2, "0") !== month ||
    check.day.padStart(2, "0") !== day
  ) {
    return null;
  }
  return zoned;
}

function monthIndex(monthName: string): number {
  const months = [
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
  ];
  return months.indexOf(monthName);
}

/** Trial end shown on the invite: signup instant plus trial_days. */
export function trialEndFrom(start: Date, trialDays: number): Date {
  return new Date(start.getTime() + trialDays * 24 * 60 * 60 * 1000);
}

export const PRICE_CHANGE_NOTICE_MS = 30 * 24 * 60 * 60 * 1000;
export const TRIAL_REMINDER_MS = 7 * 24 * 60 * 60 * 1000;

function addUtcYears(date: Date, years: number): Date {
  const next = new Date(date.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + years);
  return next;
}

/**
 * Price switches only at a renewal that is at least 30 days away.
 * If the next renewal is sooner, the following annual renewal is used.
 */
export function priceSwitchAt(periodEnd: Date, now: Date): Date {
  let candidate = new Date(periodEnd.getTime());
  let guard = 0;
  while (candidate.getTime() - now.getTime() < PRICE_CHANGE_NOTICE_MS) {
    candidate = addUtcYears(candidate, 1);
    guard += 1;
    if (guard > 5) break;
  }
  return candidate;
}

export function noticeDueAt(switchAt: Date): Date {
  return new Date(switchAt.getTime() - PRICE_CHANGE_NOTICE_MS);
}

export function trialReminderDue(trialEndsAt: Date, now: Date): boolean {
  const remaining = trialEndsAt.getTime() - now.getTime();
  return remaining > 0 && remaining <= TRIAL_REMINDER_MS;
}

export function priceNoticeDue(noticeAt: Date, switchAt: Date, now: Date): boolean {
  return now.getTime() >= noticeAt.getTime() && now.getTime() < switchAt.getTime();
}
