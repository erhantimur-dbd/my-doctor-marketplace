import { format, formatDistanceToNow, isToday, isTomorrow, parseISO, type Locale } from "date-fns";
import { enGB, de, tr, fr } from "date-fns/locale";

const localeMap: Record<string, Locale> = {
  en: enGB,
  de: de,
  tr: tr,
  fr: fr,
};

export function formatDate(
  date: string | Date,
  formatStr: string = "PPP",
  locale: string = "en"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, formatStr, { locale: localeMap[locale] || enGB });
}

export function formatRelativeDate(
  date: string | Date,
  locale: string = "en"
): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return formatDistanceToNow(d, {
    addSuffix: true,
    locale: localeMap[locale] || enGB,
  });
}

export function formatTimeSlot(time: string): string {
  return format(parseISO(`2000-01-01T${time}`), "HH:mm");
}

export function getDateLabel(date: Date, locale: string = "en"): string {
  if (isToday(date)) return "Today";
  if (isTomorrow(date)) return "Tomorrow";
  return formatDate(date, "EEE, d MMM", locale);
}
