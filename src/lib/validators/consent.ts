import { z } from "zod/v4";

export const cookieConsentSchema = z.object({
  analytics: z.boolean(),
  marketing: z.boolean(),
});

export type CookieConsentInput = z.infer<typeof cookieConsentSchema>;
