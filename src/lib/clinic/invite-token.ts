/** clinic_invitations.token default is encode(gen_random_bytes(32), 'hex'). */
export const CLINIC_INVITE_TOKEN_PATTERN = /^[0-9a-f]{64}$/i;

export function isClinicInviteToken(token: string): boolean {
  return CLINIC_INVITE_TOKEN_PATTERN.test(token);
}

/** Columns the public /invite/[token] page renders. */
export const PUBLIC_CLINIC_INVITE_COLUMNS =
  "id, email, role, token, expires_at, organization_id";

/** Columns the authenticated accept flow writes with. Not returned to the page. */
export const ACCEPT_CLINIC_INVITE_COLUMNS =
  "id, email, role, organization_id, invited_by, created_at, location_ids";
