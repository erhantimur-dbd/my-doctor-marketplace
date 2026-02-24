import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "tr", "fr", "it", "es", "pt"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
});
