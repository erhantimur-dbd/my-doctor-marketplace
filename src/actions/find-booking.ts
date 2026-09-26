"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/client";
import { bookingManageLinkEmail } from "@/lib/email/templates";
import { getRequestOrigin } from "@/lib/http/origin";
import { log } from "@/lib/utils/logger";
import {
  FIND_BOOKING_MISS,
  performGuestBookingLookup,
  performManageLinkRequest,
  toPublicBookingView,
  type LookupBookingRow,
  type PublicBookingView,
} from "@/lib/booking/find-booking";
import {
  MANAGE_TOKEN_INVALID,
  assessManageToken,
  authorizeBookingChange,
  hashManageToken,
  type ManageTokenRecord,
  type ManageTokenStore,
} from "@/lib/booking/manage-token";

const LOOKUP_SELECT = `
  id,
  booking_number,
  appointment_date,
  start_time,
  end_time,
  consultation_type,
  status,
  currency,
  total_amount_cents,
  payment_mode,
  deposit_amount_cents,
  paid_at,
  video_room_url,
  patient:profiles!bookings_patient_id_fkey(email),
  doctor:doctors!bookings_doctor_id_fkey(
    title,
    profile:profiles!doctors_profile_id_fkey(first_name, last_name)
  )
`;

async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

function unwrap<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function mapRow(data: Record<string, unknown>): LookupBookingRow {
  const patient = unwrap(
    data.patient as
      | { email?: string | null }
      | { email?: string | null }[]
      | null
  );
  const doctor = unwrap(
    data.doctor as
      | {
          title?: string | null;
          profile?:
            | { first_name?: string | null; last_name?: string | null }
            | { first_name?: string | null; last_name?: string | null }[]
            | null;
        }
      | null
  );
  const profile = unwrap(doctor?.profile ?? null);
  return {
    id: String(data.id),
    bookingNumber: String(data.booking_number ?? ""),
    appointmentDate: String(data.appointment_date ?? ""),
    startTime: String(data.start_time ?? ""),
    endTime: data.end_time ? String(data.end_time) : null,
    consultationType: String(data.consultation_type ?? ""),
    status: String(data.status ?? ""),
    currency: String(data.currency ?? "GBP"),
    totalAmountCents: Number(data.total_amount_cents ?? 0),
    paymentMode: data.payment_mode ? String(data.payment_mode) : null,
    depositAmountCents:
      data.deposit_amount_cents == null
        ? null
        : Number(data.deposit_amount_cents),
    paidAt: data.paid_at ? String(data.paid_at) : null,
    videoRoomUrl: data.video_room_url ? String(data.video_room_url) : null,
    patientEmail: patient?.email ?? null,
    doctorTitle: doctor?.title ?? null,
    doctorFirstName: profile?.first_name ?? null,
    doctorLastName: profile?.last_name ?? null,
  };
}

async function findByNumber(
  bookingNumber: string
): Promise<LookupBookingRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(LOOKUP_SELECT)
    .eq("booking_number", bookingNumber)
    .maybeSingle();
  if (error) {
    log.error("find booking lookup failed", { err: error });
    return null;
  }
  if (!data) return null;
  return mapRow(data as Record<string, unknown>);
}

async function findById(bookingId: string): Promise<LookupBookingRow | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("bookings")
    .select(LOOKUP_SELECT)
    .eq("id", bookingId)
    .maybeSingle();
  if (error || !data) {
    if (error) log.error("find booking by id failed", { err: error });
    return null;
  }
  return mapRow(data as Record<string, unknown>);
}

function dbTokenStore(admin: SupabaseClient): ManageTokenStore {
  return {
    async put(hash, record) {
      const { error } = await admin.from("booking_manage_tokens").insert({
        booking_id: record.bookingId,
        token_hash: hash,
        expires_at: new Date(record.expiresAt).toISOString(),
      });
      if (error) throw error;
    },
    async get(hash): Promise<ManageTokenRecord | null> {
      const { data, error } = await admin
        .from("booking_manage_tokens")
        .select("booking_id, expires_at, used_at")
        .eq("token_hash", hash)
        .maybeSingle();
      if (error || !data) return null;
      return {
        bookingId: String(data.booking_id),
        expiresAt: new Date(String(data.expires_at)).getTime(),
        usedAt: data.used_at ? new Date(String(data.used_at)).getTime() : null,
      };
    },
    async consume(hash, now) {
      const { data, error } = await admin
        .from("booking_manage_tokens")
        .update({ used_at: new Date(now).toISOString() })
        .eq("token_hash", hash)
        .is("used_at", null)
        .gt("expires_at", new Date(now).toISOString())
        .select("booking_id, expires_at")
        .maybeSingle();
      if (error || !data) return null;
      return {
        bookingId: String(data.booking_id),
        expiresAt: new Date(String(data.expires_at)).getTime(),
        usedAt: now,
      };
    },
  };
}

export async function lookupGuestBooking(input: {
  bookingNumber: string;
  email: string;
}): Promise<
  | { ok: true; booking: PublicBookingView }
  | { ok: false; error: string }
> {
  try {
    const ip = await clientIp();
    return await performGuestBookingLookup(
      { ...input, ip },
      { limit: rateLimit, findByNumber }
    );
  } catch (err) {
    log.error("lookupGuestBooking failed", { err });
    return { ok: false, error: FIND_BOOKING_MISS };
  }
}

export async function requestBookingManageLink(input: {
  bookingNumber: string;
  email: string;
  locale: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const ip = await clientIp();
    const origin = await getRequestOrigin();
    const admin = createAdminClient();
    return await performManageLinkRequest(
      {
        bookingNumber: input.bookingNumber,
        email: input.email,
        ip,
        origin,
        locale: input.locale || "en",
      },
      {
        limit: rateLimit,
        findByNumber,
        store: dbTokenStore(admin),
        send: sendEmail,
        now: Date.now(),
        buildEmail: ({ bookingNumber, manageUrl }) =>
          bookingManageLinkEmail({ bookingNumber, manageUrl }),
      }
    );
  } catch (err) {
    log.error("requestBookingManageLink failed", { err });
    return { ok: false, error: FIND_BOOKING_MISS };
  }
}

export async function previewManageLink(
  token: string
): Promise<
  { ok: true; booking: PublicBookingView } | { ok: false; error: string }
> {
  const trimmed = token.trim();
  if (!trimmed) return { ok: false, error: MANAGE_TOKEN_INVALID };
  try {
    const admin = createAdminClient();
    const record = await dbTokenStore(admin).get(hashManageToken(trimmed));
    if (assessManageToken(record, Date.now()) !== "valid" || !record) {
      return { ok: false, error: MANAGE_TOKEN_INVALID };
    }
    const row = await findById(record.bookingId);
    if (!row) return { ok: false, error: MANAGE_TOKEN_INVALID };
    return { ok: true, booking: toPublicBookingView(row) };
  } catch (err) {
    log.error("previewManageLink failed", { err });
    return { ok: false, error: MANAGE_TOKEN_INVALID };
  }
}

/**
 * Consumes the emailed token, then opens the existing patient manage page
 * via a one-time magic link. Without the token this does not sign anyone in.
 */
export async function redeemManageLink(
  token: string,
  locale: string
): Promise<{ error: string } | void> {
  const trimmed = token.trim();
  if (!trimmed) return { error: MANAGE_TOKEN_INVALID };
  const admin = createAdminClient();
  const store = dbTokenStore(admin);
  const existing = await store.get(hashManageToken(trimmed));
  if (assessManageToken(existing, Date.now()) !== "valid" || !existing) {
    return { error: MANAGE_TOKEN_INVALID };
  }

  const { data: booking, error } = await admin
    .from("bookings")
    .select("id, patient:profiles!bookings_patient_id_fkey(email)")
    .eq("id", existing.bookingId)
    .maybeSingle();
  const patient = unwrap(
    (booking as { patient?: { email?: string | null } | { email?: string | null }[] } | null)
      ?.patient
  );
  const email = patient?.email?.trim();
  if (error || !booking || !email) {
    return { error: MANAGE_TOKEN_INVALID };
  }

  const origin = await getRequestOrigin();
  const safeLocale = locale || "en";
  const next = `/${safeLocale}/dashboard/bookings/${existing.bookingId}`;
  const { data: link, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: `${origin}/${safeLocale}/callback?next=${encodeURIComponent(next)}`,
    },
  });
  const actionLink = link?.properties?.action_link;
  if (linkError || !actionLink) {
    log.error("manage link magic session failed", { err: linkError });
    return {
      error: "We couldn't open booking management. Request a new link.",
    };
  }

  const authorized = await authorizeBookingChange({
    token: trimmed,
    bookingId: existing.bookingId,
    store,
    now: Date.now(),
  });
  if (!authorized.ok) return { error: authorized.error };

  redirect(actionLink);
}
