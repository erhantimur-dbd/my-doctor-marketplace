"use client";

import { AlertTriangle, ExternalLink, Phone } from "lucide-react";
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

const EMERGENCY_SERVICE_URLS: Record<string, { url: string; labelKey: string }> = {
  GB: {
    url: "https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/find-urgent-and-emergency-care-services/",
    labelKey: "emergency_find_services_nhs",
  },
  DE: {
    url: "https://www.116117.de/de/notdienstpraxen.php",
    labelKey: "emergency_find_services_de",
  },
  FR: {
    url: "https://www.sante.fr/en-cas-durgence-conseils-et-numeros-utiles",
    labelKey: "emergency_find_services_fr",
  },
  TR: {
    url: "https://www.saglik.gov.tr/EN-101190/emergency-healthcare-services-are-everywhere.html",
    labelKey: "emergency_find_services_tr",
  },
};

const LOCALE_TO_COUNTRY: Record<string, string> = {
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

function resolveCountry(locale: string, countryCode?: string | null): string {
  if (countryCode && EMERGENCY_NUMBERS[countryCode]) return countryCode;
  return LOCALE_TO_COUNTRY[locale] || "DE";
}

interface EmergencyWarningProps {
  locale: string;
  reason?: string | null;
  countryCode?: string | null;
}

export function EmergencyWarning({ locale, reason, countryCode }: EmergencyWarningProps) {
  const t = useTranslations("ai");
  const country = resolveCountry(locale, countryCode);
  const number = EMERGENCY_NUMBERS[country] || "112";
  const serviceLink = EMERGENCY_SERVICE_URLS[country];

  return (
    <div className="rounded-lg border-2 border-red-500 bg-red-50 p-4 dark:border-red-400 dark:bg-red-950/30">
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:text-left">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-800 dark:text-red-200">
            {t("emergency_warning")}
          </p>
          {reason && (
            <p className="mt-1 text-xs text-red-700 dark:text-red-300">
              {reason}
            </p>
          )}
          <div className="mt-2 flex flex-col items-center gap-2 sm:flex-row sm:justify-center">
            <a
              href={`tel:${number}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700"
            >
              <Phone className="h-3.5 w-3.5" />
              {t("emergency_call", { number })}
            </a>
            {serviceLink && (
              <a
                href={serviceLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-600 dark:bg-red-950/50 dark:text-red-300 dark:hover:bg-red-950/70"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {t(serviceLink.labelKey)}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
