"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validators/password";
import { log } from "@/lib/utils/logger";
import { normalizeLookupEmail } from "@/lib/booking/find-booking";
import {
  EXISTING_ACCOUNT_MESSAGE,
  classifyGuestAuthUser,
  planGuestSignup,
  type GuestBookingCandidate,
} from "@/lib/booking/guest-account-link";

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

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

export async function createGuestAccount(input: {
  bookingId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  locale: string;
}): Promise<{ ok: true } | { ok: false; error: string; existingAccount?: boolean }> {
  const ip = await clientIp();
  const { limited } = await rateLimit(`guest-account:${ip}`, 5, 15 * 60 * 1000);
  if (limited) {
    return { ok: false, error: "Too many attempts. Please try again later." };
  }

  const pw = passwordSchema.safeParse(input.password);
  if (!pw.success) {
    return { ok: false, error: pw.error.issues[0]?.message || "Password too weak." };
  }

  const admin = createAdminClient();
  const { data: booking, error: bookingError } = await admin
    .from("bookings")
    .select(
      "id, is_guest, patient_id, patient:profiles!bookings_patient_id_fkey(email)"
    )
    .eq("id", input.bookingId)
    .maybeSingle();

  if (bookingError || !booking || booking.is_guest !== true) {
    return { ok: false, error: "This booking cannot be attached to an account." };
  }

  const patient = unwrap(
    booking.patient as { email?: string | null } | { email?: string | null }[] | null
  );
  const bookingEmail = patient?.email ?? null;
  const { data: authData, error: authError } = await admin.auth.admin.getUserById(
    booking.patient_id
  );
  if (authError) {
    log.error("guest account lookup failed", { err: authError });
  }
  const authUser = authData?.user ?? null;
  const meta = (authUser?.user_metadata ?? {}) as Record<string, unknown>;
  const accountKind = classifyGuestAuthUser({
    bookingPatientId: booking.patient_id,
    authUserId: authUser?.id ?? null,
    createdVia: typeof meta.created_via === "string" ? meta.created_via : null,
    passwordSetAt:
      typeof meta.password_set_at === "string" ? meta.password_set_at : null,
  });

  if (accountKind === "existing_account") {
    return { ok: false, error: EXISTING_ACCOUNT_MESSAGE, existingAccount: true };
  }

  const verifiedEmail = normalizeLookupEmail(authUser?.email || bookingEmail);
  let candidates: GuestBookingCandidate[] = [];
  if (verifiedEmail.includes("@")) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, email")
      .ilike("email", escapeLike(verifiedEmail));
    const profileIds = (profiles ?? [])
      .filter((row) => normalizeLookupEmail(row.email) === verifiedEmail)
      .map((row) => row.id);
    if (profileIds.length > 0) {
      const { data: rows } = await admin
        .from("bookings")
        .select(
          "id, is_guest, patient_id, patient:profiles!bookings_patient_id_fkey(email)"
        )
        .in("patient_id", profileIds);
      candidates = (rows ?? []).map((row) => {
        const rowPatient = unwrap(
          row.patient as
            | { email?: string | null }
            | { email?: string | null }[]
            | null
        );
        return {
          id: row.id,
          isGuest: row.is_guest === true,
          patientId: row.patient_id,
          patientEmail: rowPatient?.email ?? null,
        };
      });
    }
  }

  const plan = planGuestSignup({
    isGuestBooking: true,
    loggedIn: false,
    submittedEmail: input.email,
    bookingEmail,
    emailConfirmed: Boolean(authUser?.email_confirmed_at),
    authEmail: authUser?.email ?? null,
    accountKind,
    bookings: candidates,
  });

  if (plan.action === "login") {
    return { ok: false, error: EXISTING_ACCOUNT_MESSAGE, existingAccount: true };
  }
  if (plan.action !== "claim" || !authUser) {
    return {
      ok: false,
      error:
        plan.action === "reject"
          ? plan.error
          : "We couldn't create an account for this booking.",
    };
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(
    authUser.id,
    {
      password: input.password,
      user_metadata: {
        ...meta,
        first_name: input.firstName.trim() || meta.first_name,
        last_name: input.lastName.trim() || meta.last_name,
        password_set_at: new Date().toISOString(),
      },
    }
  );
  if (updateError) {
    const message = updateError.message.toLowerCase();
    if (message.includes("already") || message.includes("registered")) {
      return { ok: false, error: EXISTING_ACCOUNT_MESSAGE, existingAccount: true };
    }
    log.error("guest account password update failed", { err: updateError });
    return { ok: false, error: "We couldn't create an account. Please try again." };
  }

  if (input.firstName.trim() || input.lastName.trim()) {
    await admin
      .from("profiles")
      .update({
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      })
      .eq("id", authUser.id);
  }

  if (plan.bookingIds.length > 0) {
    const { error: linkError } = await admin
      .from("bookings")
      .update({ patient_id: authUser.id })
      .in("id", plan.bookingIds);
    if (linkError) {
      log.error("guest booking link failed", { err: linkError });
      return {
        ok: false,
        error: "Account created, but we couldn't attach the booking. Please log in.",
        existingAccount: true,
      };
    }
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: verifiedEmail,
    password: input.password,
  });
  if (signInError) {
    return { ok: false, error: EXISTING_ACCOUNT_MESSAGE, existingAccount: true };
  }

  redirect(`/${input.locale || "en"}/dashboard/bookings`);
}
