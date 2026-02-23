import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "de", "tr", "fr"],
  defaultLocale: "en",
  localePrefix: "always",
});
