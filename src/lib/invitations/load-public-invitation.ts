export const PUBLIC_FOLLOW_UP_INVITATION_RPC =
  "get_follow_up_invitation_by_token";

export interface PublicFollowUpDoctor {
  id: string;
  title: string | null;
  clinic_name: string | null;
  profile: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
  location: { city: string | null } | null;
}

/** Columns the public invitation and confirmed pages render. */
export interface PublicFollowUpInvitation {
  id: string;
  status: string;
  expires_at: string;
  consultation_type: string;
  discount_type: string | null;
  discount_value: number | null;
  unit_price_cents: number;
  total_sessions: number;
  discounted_total_cents: number;
  service_name: string;
  duration_minutes: number;
  platform_fee_cents: number;
  currency: string;
  doctor_note: string | null;
  sessions_booked: number;
  doctor: PublicFollowUpDoctor;
}

type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

export interface PublicInvitationRpcClient {
  rpc: (
    fn: string,
    args: { p_token: string }
  ) => PromiseLike<RpcResult>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Copy only the public invitation shape. Extra keys from a wider row
 * (patient_id, Stripe ids, token) are dropped.
 */
export function toPublicFollowUpInvitation(
  value: unknown
): PublicFollowUpInvitation | null {
  const row = asRecord(value);
  const doctor = asRecord(row?.doctor);
  if (!row || !doctor) return null;

  const id = asString(row.id);
  const status = asString(row.status);
  const expiresAt = asString(row.expires_at);
  const consultationType = asString(row.consultation_type);
  const serviceName = asString(row.service_name);
  const currency = asString(row.currency);
  const doctorId = asString(doctor.id);
  const unitPrice = asNumber(row.unit_price_cents);
  const totalSessions = asNumber(row.total_sessions);
  const discountedTotal = asNumber(row.discounted_total_cents);
  const durationMinutes = asNumber(row.duration_minutes);
  const platformFee = asNumber(row.platform_fee_cents);
  const sessionsBooked = asNumber(row.sessions_booked);

  if (
    !id ||
    !status ||
    !expiresAt ||
    !consultationType ||
    !serviceName ||
    !currency ||
    !doctorId ||
    unitPrice === null ||
    totalSessions === null ||
    discountedTotal === null ||
    durationMinutes === null ||
    platformFee === null ||
    sessionsBooked === null
  ) {
    return null;
  }

  const profile = asRecord(doctor.profile);
  const location = asRecord(doctor.location);

  return {
    id,
    status,
    expires_at: expiresAt,
    consultation_type: consultationType,
    discount_type: asString(row.discount_type),
    discount_value: asNumber(row.discount_value),
    unit_price_cents: unitPrice,
    total_sessions: totalSessions,
    discounted_total_cents: discountedTotal,
    service_name: serviceName,
    duration_minutes: durationMinutes,
    platform_fee_cents: platformFee,
    currency,
    doctor_note: asString(row.doctor_note),
    sessions_booked: sessionsBooked,
    doctor: {
      id: doctorId,
      title: asString(doctor.title),
      clinic_name: asString(doctor.clinic_name),
      profile: profile
        ? {
            first_name: asString(profile.first_name),
            last_name: asString(profile.last_name),
            avatar_url: asString(profile.avatar_url),
          }
        : null,
      location: location ? { city: asString(location.city) } : null,
    },
  };
}

export async function loadPublicFollowUpInvitation(
  supabase: PublicInvitationRpcClient,
  token: string
): Promise<PublicFollowUpInvitation | null> {
  const { data, error } = await supabase.rpc(PUBLIC_FOLLOW_UP_INVITATION_RPC, {
    p_token: token,
  });
  if (error || data == null) return null;
  return toPublicFollowUpInvitation(data);
}
