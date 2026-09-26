import { createClient } from "@/lib/supabase/server";
import { isSoftLaunchSoftsmokeDoctor } from "@/lib/soft-launch/softsmoke-connect-bypass";
import { log } from "@/lib/utils/logger";
import {
  activityStatementSelect,
  assertActivityStatementSelectIsSafe,
  buildActivityStatement,
  londonMonthBounds,
  parseStatementMonth,
  type ActivityStatement,
  type ActivityStatementScope,
  type StatementBookingSource,
} from "@/lib/statements/activity-statement";

const STATEMENT_ROW_LIMIT = 1000;

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type DoctorGate =
  | { allowed: false; reason: "unauthenticated" | "not_doctor" | "hidden" }
  | {
      allowed: true;
      supabase: SupabaseServerClient;
      userId: string;
      doctorId: string;
      doctorName: string;
      currency: string;
    };

type Viewer =
  | { allowed: false; reason: "unauthenticated" | "not_doctor" | "hidden" }
  | {
      allowed: true;
      supabase: SupabaseServerClient;
      doctorId: string;
      doctorName: string;
      currency: string;
      organization: { id: string; name: string } | null;
      canViewOrganization: boolean;
    };

type NameRow = { first_name?: string | null; last_name?: string | null };

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function displayName(row: NameRow | null, fallback: string): string {
  const name = `${row?.first_name ?? ""} ${row?.last_name ?? ""}`.trim();
  return name || fallback;
}

/** Allowlist and doctor row only. Used by the dashboard nav on every page. */
async function getActivityStatementDoctor(): Promise<DoctorGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { allowed: false, reason: "unauthenticated" };

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, slug, base_currency")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!doctor) return { allowed: false, reason: "not_doctor" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();

  const allowed = isSoftLaunchSoftsmokeDoctor({
    id: doctor.id,
    slug: doctor.slug,
    email: profile?.email ?? user.email ?? null,
  });
  if (!allowed) return { allowed: false, reason: "hidden" };

  const person = displayName(profile, "");
  return {
    allowed: true,
    supabase,
    userId: user.id,
    doctorId: doctor.id,
    doctorName: person ? `Dr ${person}` : "Doctor",
    currency: (doctor.base_currency || "GBP").toUpperCase(),
  };
}

/** Nav gate. Does not look up organization membership. */
export async function canShowActivityStatementNav(): Promise<boolean> {
  try {
    const doctor = await getActivityStatementDoctor();
    return doctor.allowed;
  } catch (err) {
    log.error("Activity statement nav gate failed", { err });
    return false;
  }
}

export async function getActivityStatementViewer(): Promise<Viewer> {
  const doctor = await getActivityStatementDoctor();
  if (!doctor.allowed) return doctor;

  const { supabase, userId } = doctor;
  let organization: { id: string; name: string } | null = null;
  let canViewOrganization = false;
  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(id, name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  if (membershipError) {
    log.error("Activity statement org lookup failed", { err: membershipError });
  } else if (membership) {
    const org = unwrap(
      membership.organization as { id?: string; name?: string } | { id?: string; name?: string }[] | null
    );
    if (org?.id) {
      organization = { id: org.id, name: (org.name ?? "").trim() || "Clinic" };
      canViewOrganization = membership.role === "owner" || membership.role === "admin";
    }
  }

  return {
    allowed: true,
    supabase,
    doctorId: doctor.doctorId,
    doctorName: doctor.doctorName,
    currency: doctor.currency,
    organization,
    canViewOrganization,
  };
}

type BookingRow = {
  id?: string | null;
  booking_number?: string | null;
  appointment_date?: string | null;
  start_time?: string | null;
  consultation_type?: string | null;
  service_name?: string | null;
  status?: string | null;
  currency?: string | null;
  consultation_fee_cents?: number | null;
  platform_fee_cents?: number | null;
  commission_cents?: number | null;
  total_amount_cents?: number | null;
  deposit_amount_cents?: number | null;
  payment_mode?: string | null;
  wallet_credit_applied_cents?: number | null;
  refund_amount_cents?: number | null;
  paid_at?: string | null;
  refunded_at?: string | null;
  doctor_id?: string | null;
  stripe_payment_intent_id?: string | null;
  reschedule_price_diff_cents?: number | null;
  reschedule_payment_status?: string | null;
  rescheduled_from_booking_id?: string | null;
  patient?: NameRow | NameRow[] | null;
  doctor?:
    | { profile?: NameRow | NameRow[] | null }
    | { profile?: NameRow | NameRow[] | null }[]
    | null;
};

function toSource(row: BookingRow): StatementBookingSource {
  const patient = unwrap(row.patient);
  const doctor = unwrap(row.doctor);
  const clinician = unwrap(doctor?.profile ?? null);
  return {
    id: row.id,
    doctorId: row.doctor_id,
    bookingNumber: row.booking_number ?? "",
    appointmentDate: row.appointment_date,
    startTime: row.start_time,
    consultationType: row.consultation_type,
    serviceName: row.service_name,
    status: row.status,
    currency: row.currency,
    consultationFeeCents: row.consultation_fee_cents,
    platformFeeCents: row.platform_fee_cents,
    commissionCents: row.commission_cents,
    totalAmountCents: row.total_amount_cents,
    depositAmountCents: row.deposit_amount_cents,
    paymentMode: row.payment_mode,
    walletCreditAppliedCents: row.wallet_credit_applied_cents,
    refundAmountCents: row.refund_amount_cents,
    paidAt: row.paid_at,
    refundedAt: row.refunded_at,
    stripePaymentIntentId: row.stripe_payment_intent_id,
    reschedulePriceDiffCents: row.reschedule_price_diff_cents,
    reschedulePaymentStatus: row.reschedule_payment_status,
    rescheduledFromBookingId: row.rescheduled_from_booking_id,
    patientFirstName: patient?.first_name,
    patientLastName: patient?.last_name,
    clinicianName: clinician ? displayName(clinician, "") : null,
  };
}

export type LoadedActivityStatement =
  | { status: "unauthenticated" }
  | { status: "not_doctor" }
  | { status: "hidden" }
  | { status: "error" }
  | {
      status: "ok";
      statement: ActivityStatement;
      monthKey: string;
      scope: ActivityStatementScope;
      canViewOrganization: boolean;
      organizationName: string | null;
    };

export async function loadActivityStatement(input: {
  month?: string | null;
  scope?: string | null;
  now?: Date;
}): Promise<LoadedActivityStatement> {
  const viewer = await getActivityStatementViewer();
  if (!viewer.allowed) return { status: viewer.reason };

  const month = parseStatementMonth(input.month, input.now);
  const wantsOrganization = input.scope === "organization";
  const scope: ActivityStatementScope =
    wantsOrganization && viewer.canViewOrganization && viewer.organization
      ? "organization"
      : "doctor";

  const bounds = londonMonthBounds(month.year, month.month);
  const startIso = bounds.start.toISOString();
  const endIso = bounds.end.toISOString();
  const includeClinician = scope === "organization";
  const select = activityStatementSelect(includeClinician);
  assertActivityStatementSelectIsSafe(select);

  const scoped = () => {
    let query = viewer.supabase.from("bookings").select(select);
    if (scope === "organization" && viewer.organization) {
      query = query.eq("organization_id", viewer.organization.id);
    } else {
      query = query.eq("doctor_id", viewer.doctorId);
    }
    return query;
  };

  const [paidResult, refundedResult] = await Promise.all([
    scoped().gte("paid_at", startIso).lt("paid_at", endIso).limit(STATEMENT_ROW_LIMIT),
    scoped()
      .gte("refunded_at", startIso)
      .lt("refunded_at", endIso)
      .limit(STATEMENT_ROW_LIMIT),
  ]);

  if (paidResult.error || refundedResult.error) {
    log.error("Activity statement query failed", {
      err: paidResult.error ?? refundedResult.error,
    });
    return { status: "error" };
  }

  const merged = new Map<string, BookingRow>();
  for (const row of [...(paidResult.data ?? []), ...(refundedResult.data ?? [])] as BookingRow[]) {
    const key = row.id || row.booking_number || "";
    if (!key || merged.has(key)) continue;
    merged.set(key, row);
  }
  const rows = [...merged.values()];
  const truncated =
    (paidResult.data?.length ?? 0) >= STATEMENT_ROW_LIMIT ||
    (refundedResult.data?.length ?? 0) >= STATEMENT_ROW_LIMIT;
  const statement = buildActivityStatement({
    year: month.year,
    month: month.month,
    bookings: rows.map(toSource),
    payeeName:
      scope === "organization" && viewer.organization
        ? viewer.organization.name
        : viewer.doctorName,
    scopeLabel:
      scope === "organization"
        ? "This clinic"
        : "This doctor",
    now: input.now,
    truncated,
    fallbackCurrency: viewer.currency,
    showClinician: includeClinician,
    viewerDoctorId: viewer.doctorId,
  });

  return {
    status: "ok",
    statement,
    monthKey: month.key,
    scope,
    canViewOrganization: viewer.canViewOrganization,
    organizationName: viewer.organization?.name ?? null,
  };
}
