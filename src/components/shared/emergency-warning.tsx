"use client";

import { AlertTriangle, Phone } from "lucide-react";
import { useTranslations } from "next-intl";

const EMERGENCY_NUMBERS: Record<string, string> = {
  DE: "112",
  AT: "112",
  CH: "144",
  TR: "112",
  FR: "15",
  IT: "118",
  ES: "112",
  PT: "112",
  GB: "999",
  US: "911",
  JP: "119",
  CN: "120",
};

function getEmergencyNumber(locale: string): string {
  const countryMap: Record<string, string> = {
    de: "DE",
    tr: "TR",
    fr: "FR",
    it: "IT",
    es: "ES",
    pt: "PT",
    en: "GB",
    zh: "CN",
    ja: "JP",
  };
  const country = countryMap[locale] || "DE";
  return EMERGENCY_NUMBERS[country] || "112";
}

interface EmergencyWarningProps {
  locale: string;
  reason?: string | null;
}

export function EmergencyWarning({ locale, reason }: EmergencyWarningProps) {
  const t = useTranslations("ai");
  const number = getEmergencyNumber(locale);

  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:border-red-400 dark:bg-red-950/30">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {t("emergency_warning")}
          </p>
          {reason && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {reason}
            </p>
          )}
          <a
            href={`tel:${number}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            <Phone className="h-3.5 w-3.5" />
            {t("emergency_call", { number })}
          </a>
        </div>
      </div>
    </div>
  );
}
