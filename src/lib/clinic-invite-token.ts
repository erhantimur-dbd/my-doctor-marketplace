/**
 * Clinic seat-invite tokens are 32-byte hex (64 chars).
 * Kept in a zero-import module so Edge middleware can rewrite
 * /invite/<token> → /invite/accept/<token> without pulling specialty
 * copy, Stripe, or Node-only deps into the Edge bundle.
 */
export function isClinicInviteToken(value: string): boolean {
  if (value.length !== 64) return false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    const isDigit = c >= 48 && c <= 57;
    const isLowerHex = c >= 97 && c <= 102;
    const isUpperHex = c >= 65 && c <= 70;
    if (!isDigit && !isLowerHex && !isUpperHex) return false;
  }
  return true;
}
