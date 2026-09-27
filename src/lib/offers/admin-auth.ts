export function parseOfferAdminEmails(raw: string | undefined | null): string[] {
  return (raw || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/** Empty allowlist denies everyone, including in development. */
export function isOfferAdminEmail(
  email: string | null | undefined,
  allowlist: readonly string[]
): boolean {
  if (!email) return false;
  if (allowlist.length === 0) return false;
  return allowlist.includes(email.trim().toLowerCase());
}
