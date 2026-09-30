/**
 * Emails must never carry a Daily room URL or a meeting token.
 * Tokens are short-lived and mail gets forwarded.
 */

export function safeConsultEmailHref(
  href: string | null | undefined
): string | null {
  if (!href) return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  if (/daily\.co/i.test(trimmed)) return null;
  if (/meeting-tokens/i.test(trimmed)) return null;
  if (/[?&]t=/.test(trimmed)) return null;
  return trimmed;
}
