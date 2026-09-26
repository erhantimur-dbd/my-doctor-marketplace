import { SOFT_LAUNCH_SOFTSMOKE_DOCTOR } from "@/lib/soft-launch/softsmoke-connect-bypass";

/**
 * Until launch, subscription service mail goes only to the Softsmoke tester.
 * A non-allowlisted address is written as its own `suppressed` audit row and
 * is not sent. That row does not use the send key, so a later allowed send
 * can still go out.
 */
export function isServiceEmailRecipientAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === SOFT_LAUNCH_SOFTSMOKE_DOCTOR.email;
}

export function chooseServiceRecipient(
  emails: Array<string | null | undefined>,
  allow: (email: string) => boolean = isServiceEmailRecipientAllowed
): { to: string; allowed: boolean } | null {
  const cleaned = emails
    .map((email) => email?.trim())
    .filter((email): email is string => Boolean(email));
  if (cleaned.length === 0) return null;
  const allowed = cleaned.find((email) => allow(email));
  if (allowed) return { to: allowed, allowed: true };
  return { to: cleaned[0], allowed: false };
}
