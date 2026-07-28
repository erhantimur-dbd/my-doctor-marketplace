"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { revalidatePath } from "next/cache";
import { sendEmail } from "@/lib/email/client";
import {
  availabilityAlertEmail,
  specialtyWaitlistJoinedEmail,
  specialtyAvailabilityAlertEmail,
} from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { z } from "zod/v4";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";

const guestSubscribeSchema = z.object({
  doctorId: z.string().uuid(),
  email: z.string().email().max(255),
  name: z.string().max(120).optional().nullable(),
  consent: z.literal(true),
  source: z.string().max(40).optional(),
  // Bots fill this; allow any string so we can silent-succeed after parse
  honeypot: z.string().max(200).optional().nullable(),
});

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      h.get("x-real-ip") ||
      "unknown"
    );
  } catch {
    return "unknown";
  }
}

/**
 * Logged-in patient: one-click subscribe (no Pro gate — interest capture for all doctors).
 */
export async function subscribeToAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      error: "login_required",
    };
  }

  const admin = createAdminClient();
  const { data: doctor } = await admin
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .single();

  if (!doctor) return { success: false, error: "Doctor not found." };

  const { error } = await admin.from("availability_alerts").upsert(
    {
      patient_id: user.id,
      doctor_id: doctorId,
      guest_email: null,
      guest_name: null,
      notified_at: null,
      consented_at: new Date().toISOString(),
      source: "doctor_card",
      unsubscribe_token: crypto.randomUUID(),
    },
    { onConflict: "patient_id,doctor_id" }
  );

  if (error) {
    log.error("[AvailabilityAlerts] Subscribe error:", { err: error });
    return { success: false, error: "Failed to subscribe." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/doctor-dashboard/waitlist");
  return { success: true };
}

/**
 * Guest (no account): capture email interest for a doctor with no open slots.
 */
export async function subscribeAsGuest(input: {
  doctorId: string;
  email: string;
  name?: string | null;
  consent: boolean;
  source?: string;
  honeypot?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const parsed = guestSubscribeSchema.safeParse({
    ...input,
    consent: input.consent === true ? true : undefined,
    honeypot: input.honeypot || "",
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path?.[0];
    if (path === "consent" || !input.consent) {
      return {
        success: false,
        error: "Please agree to receive availability emails.",
      };
    }
    if (path === "doctorId") {
      return {
        success: false,
        error: "Missing doctor. Please refresh and try again.",
      };
    }
    if (path === "email" || !input.email?.trim()) {
      return { success: false, error: "Please enter a valid email address." };
    }
    return {
      success: false,
      error: issue?.message || "Invalid input. Please check and try again.",
    };
  }

  // Honeypot tripped (bots only) — do not insert
  if (parsed.data.honeypot && parsed.data.honeypot.trim().length > 0) {
    return { success: true };
  }

  const ip = await clientIp();
  const email = normalizeEmail(parsed.data.email);

  try {
    const { limited: ipLimited } = await rateLimit(
      `avail-alert-ip:${ip}`,
      10,
      60 * 60 * 1000
    );
    if (ipLimited) {
      return {
        success: false,
        error: "Too many requests. Please try again later.",
      };
    }

    const { limited: emailLimited } = await rateLimit(
      `avail-alert-email:${email}`,
      5,
      60 * 60 * 1000
    );
    if (emailLimited) {
      return {
        success: false,
        error: "Too many requests for this email. Please try again later.",
      };
    }
  } catch (err) {
    // Rate limit backend failure should not block legitimate subscribers
    log.error("[AvailabilityAlerts] Rate limit error (continuing):", { err });
  }

  const admin = createAdminClient();

  const { data: doctor, error: doctorError } = await admin
    .from("doctors")
    .select("id")
    .eq("id", parsed.data.doctorId)
    .maybeSingle();

  if (doctorError) {
    log.error("[AvailabilityAlerts] Doctor lookup error:", {
      err: doctorError,
    });
    return { success: false, error: "Failed to subscribe. Please try again." };
  }
  if (!doctor) return { success: false, error: "Doctor not found." };

  // Re-arm existing guest row or insert new
  const { data: existing, error: existingError } = await admin
    .from("availability_alerts")
    .select("id")
    .eq("doctor_id", parsed.data.doctorId)
    .ilike("guest_email", email)
    .maybeSingle();

  if (existingError) {
    log.error("[AvailabilityAlerts] Existing lookup error:", {
      err: existingError,
    });
    return { success: false, error: "Failed to subscribe. Please try again." };
  }

  if (existing) {
    const { error } = await admin
      .from("availability_alerts")
      .update({
        guest_name: parsed.data.name?.trim() || null,
        notified_at: null,
        status: "waiting",
        consented_at: new Date().toISOString(),
        source: parsed.data.source || "doctor_card",
      })
      .eq("id", existing.id);

    if (error) {
      log.error("[AvailabilityAlerts] Guest re-arm error:", { err: error });
      return { success: false, error: "Failed to subscribe. Please try again." };
    }
  } else {
    const { error } = await admin.from("availability_alerts").insert({
      patient_id: null,
      doctor_id: parsed.data.doctorId,
      guest_email: email,
      guest_name: parsed.data.name?.trim() || null,
      notified_at: null,
      status: "waiting",
      consented_at: new Date().toISOString(),
      source: parsed.data.source || "doctor_card",
      unsubscribe_token: crypto.randomUUID(),
    });

    if (error) {
      log.error("[AvailabilityAlerts] Guest subscribe error:", {
        err: error,
        message: error.message,
        code: error.code,
        details: error.details,
      });
      return { success: false, error: "Failed to subscribe. Please try again." };
    }
  }

  revalidatePath("/doctor-dashboard/waitlist");
  return { success: true };
}

/**
 * Logged-in unsubscribe.
 */
export async function unsubscribeFromAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be logged in." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("availability_alerts")
    .delete()
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId);

  if (error) {
    log.error("[AvailabilityAlerts] Unsubscribe error:", { err: error });
    return { success: false, error: "Failed to unsubscribe." };
  }

  revalidatePath("/", "layout");
  revalidatePath("/doctor-dashboard/waitlist");
  return { success: true };
}

/**
 * Guest unsubscribe via email token (no login).
 */
export async function unsubscribeByToken(
  token: string
): Promise<{ success: boolean; error?: string; doctorName?: string }> {
  if (!token || token.length < 10) {
    return { success: false, error: "Invalid unsubscribe link." };
  }

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("availability_alerts")
    .select(
      `id, doctor:doctors(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (!row) return { success: false, error: "This link is invalid or already used." };

  const doctor: any = Array.isArray(row.doctor) ? row.doctor[0] : row.doctor;
  const profile: any = doctor?.profile
    ? Array.isArray(doctor.profile)
      ? doctor.profile[0]
      : doctor.profile
    : null;
  const doctorName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "this doctor";

  const { error } = await admin
    .from("availability_alerts")
    .delete()
    .eq("id", row.id);

  if (error) {
    log.error("[AvailabilityAlerts] Token unsubscribe error:", { err: error });
    return { success: false, error: "Failed to unsubscribe." };
  }

  return { success: true, doctorName };
}

/**
 * Check if current user is subscribed (logged-in only).
 */
export async function getAvailabilityAlert(
  doctorId: string
): Promise<{ subscribed: boolean; isLoggedIn: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { subscribed: false, isLoggedIn: false };

  const { data } = await supabase
    .from("availability_alerts")
    .select("id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  return { subscribed: !!data, isLoggedIn: true };
}

/**
 * Doctor portal: list people waiting for this doctor's availability.
 */
export async function getDoctorWaitlist(): Promise<{
  error?: string;
  waiting: Array<{
    id: string;
    name: string;
    email: string;
    status: "waiting" | "notified";
    createdAt: string;
    notifiedAt: string | null;
    isGuest: boolean;
  }>;
  waitingCount: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated", waiting: [], waitingCount: 0 };

  const admin = createAdminClient();
  const { data: doctor } = await admin
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) return { error: "Doctor profile not found", waiting: [], waitingCount: 0 };

  const { data: rows, error } = await admin
    .from("availability_alerts")
    .select(
      `
      id, guest_email, guest_name, patient_id, notified_at, created_at,
      patient:profiles!availability_alerts_patient_id_fkey(first_name, last_name, email)
    `
    )
    .eq("doctor_id", doctor.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    log.error("[AvailabilityAlerts] Doctor waitlist error:", { err: error });
    return { error: "Failed to load waitlist", waiting: [], waitingCount: 0 };
  }

  const waiting = (rows || []).map((row) => {
    const patient: any = Array.isArray(row.patient)
      ? row.patient[0]
      : row.patient;
    const isGuest = !row.patient_id;
    const name = isGuest
      ? row.guest_name || "Guest"
      : [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") ||
        "Patient";
    const email = isGuest
      ? row.guest_email || ""
      : patient?.email || "";

    return {
      id: row.id,
      name,
      email,
      status: (row.notified_at ? "notified" : "waiting") as "waiting" | "notified",
      createdAt: row.created_at,
      notifiedAt: row.notified_at,
      isGuest,
    };
  });

  const waitingCount = waiting.filter((w) => w.status === "waiting").length;
  return { waiting, waitingCount };
}

/**
 * Notify patients/guests subscribed to a doctor's availability.
 * Called when a doctor gains new open slots (e.g. cancellation).
 */
export async function notifyAvailabilitySubscribers(
  doctorId: string,
  doctorName: string,
  doctorSlug: string
): Promise<{ notifiedCount: number }> {
  const admin = createAdminClient();

  // Interest capture is open to all doctors — always notify waiters
  const { data: alerts } = await admin
    .from("availability_alerts")
    .select(
      `
      id, patient_id, guest_email, guest_name, unsubscribe_token,
      patient:profiles!availability_alerts_patient_id_fkey(first_name, email)
    `
    )
    .eq("doctor_id", doctorId)
    .is("notified_at", null);

  if (!alerts || alerts.length === 0) return { notifiedCount: 0 };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
  const bookingUrl = `${appUrl}/en/doctors/${doctorSlug}/book`;
  let notifiedCount = 0;

  for (const alert of alerts) {
    try {
      const patient: any = Array.isArray(alert.patient)
        ? alert.patient[0]
        : alert.patient;

      const isGuest = !alert.patient_id;
      const email = isGuest
        ? alert.guest_email
        : patient?.email;
      const firstName = isGuest
        ? alert.guest_name?.split(/\s+/)[0] || "there"
        : patient?.first_name || "there";

      // In-app only for registered patients
      if (alert.patient_id) {
        await createNotification({
          userId: alert.patient_id,
          type: "availability_alert",
          title: "Doctor Now Available",
          message: `${doctorName} has new appointment slots available. Book now before they fill up!`,
          channels: ["in_app"],
          metadata: {
            doctorId,
            doctorSlug,
            doctorName,
          },
        });
      }

      if (email) {
        const unsubUrl = alert.unsubscribe_token
          ? `${appUrl}/en/unsubscribe-availability?token=${alert.unsubscribe_token}`
          : undefined;
        const { subject, html } = availabilityAlertEmail({
          patientName: firstName,
          doctorName,
          bookingUrl,
          unsubscribeUrl: unsubUrl,
        });
        sendEmail({ to: email, subject, html }).catch((err) =>
          log.error("Availability alert email failed", {
            err,
            alertId: alert.id,
          })
        );
      }

      await admin
        .from("availability_alerts")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", alert.id);

      notifiedCount++;
    } catch (err) {
      log.error("Availability alert notification error", {
        err,
        alertId: alert.id,
      });
    }
  }

  // Also fan out specialty waitlists for this doctor's specialties
  notifySpecialtyWaitlistsForDoctor(doctorId, doctorName, doctorSlug).catch(
    (err) => log.error("Specialty waitlist fan-out failed", { err, doctorId })
  );

  return { notifiedCount };
}

// ── Specialty-level demand / waitlist ─────────────────────────────

const SPECIALTY_NOTIFY_DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24h

export interface JoinSpecialtyWaitlistInput {
  specialtySlug: string;
  email?: string;
  name?: string;
  countryCode?: string | null;
  placeName?: string | null;
  placeLat?: number | null;
  placeLng?: number | null;
  consultationType?: "in_person" | "video" | null;
  source?: string;
  consent?: boolean;
  honeypot?: string | null;
}

/**
 * Join specialty waitlist (e.g. gynecology in Islington).
 * Guests need email + name + consent. Captures location for admin recruiting.
 */
export async function joinSpecialtyWaitlist(
  input: JoinSpecialtyWaitlistInput
): Promise<{ success: boolean; error?: string }> {
  if (input.honeypot) return { success: true }; // silent bot success

  const specialtySlug = input.specialtySlug?.trim();
  if (!specialtySlug) {
    return { success: false, error: "Specialty is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const guestEmail = input.email?.trim().toLowerCase() || null;
  const guestName = input.name?.trim() || null;

  if (!user && !guestEmail) {
    return {
      success: false,
      error: "Please enter your email so we can notify you.",
    };
  }
  if (!user && guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!user && input.consent !== true) {
    return {
      success: false,
      error: "Please agree to receive availability emails.",
    };
  }

  if (!user && guestEmail) {
    const ip = await clientIp();
    const { limited: ipLimited } = await rateLimit(
      `specialty-waitlist-ip:${ip}`,
      10,
      60 * 60 * 1000
    );
    if (ipLimited) {
      return { success: false, error: "Too many requests. Please try again later." };
    }
    const { limited } = await rateLimit(
      `specialty-waitlist:${guestEmail}`,
      5,
      60 * 60 * 1000
    );
    if (limited) {
      return {
        success: false,
        error: "Too many waitlist requests. Please try again later.",
      };
    }
  }

  const admin = createAdminClient();
  const row: Record<string, unknown> = {
    specialty_slug: specialtySlug,
    patient_id: user?.id ?? null,
    guest_email: user ? null : guestEmail,
    guest_name: user ? guestName : guestName || null,
    country_code: input.countryCode || null,
    place_name: input.placeName?.trim() || null,
    place_lat: input.placeLat ?? null,
    place_lng: input.placeLng ?? null,
    consultation_type: input.consultationType || null,
    source: input.source || "search_empty",
    status: "active",
    last_notified_at: null,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (user) {
    const { data: existing } = await admin
      .from("specialty_waitlist")
      .select("id")
      .eq("patient_id", user.id)
      .eq("specialty_slug", specialtySlug)
      .maybeSingle();

    if (existing) {
      ({ error } = await admin
        .from("specialty_waitlist")
        .update(row)
        .eq("id", existing.id));
    } else {
      ({ error } = await admin.from("specialty_waitlist").insert({
        ...row,
        unsubscribe_token: crypto.randomUUID(),
      }));
    }
  } else {
    const { data: existing } = await admin
      .from("specialty_waitlist")
      .select("id")
      .eq("specialty_slug", specialtySlug)
      .ilike("guest_email", guestEmail!)
      .maybeSingle();

    if (existing) {
      ({ error } = await admin
        .from("specialty_waitlist")
        .update(row)
        .eq("id", existing.id));
    } else {
      ({ error } = await admin.from("specialty_waitlist").insert({
        ...row,
        unsubscribe_token: crypto.randomUUID(),
      }));
    }
  }

  if (error) {
    log.error("[SpecialtyWaitlist] Join error:", { err: error });
    return {
      success: false,
      error: "Failed to join waitlist. Please try again.",
    };
  }

  const specialtyLabel = specialtySlugToLabel(specialtySlug);
  const toEmail = user?.email || guestEmail;
  const toName =
    guestName ||
    user?.user_metadata?.first_name ||
    user?.email?.split("@")[0] ||
    "there";

  if (toEmail) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
    const searchUrl = `${appUrl}/en/doctors?specialty=${encodeURIComponent(specialtySlug)}&sort=soonest`;
    try {
      const { subject, html } = specialtyWaitlistJoinedEmail({
        patientName: String(toName),
        specialtyLabel,
        searchUrl,
      });
      sendEmail({ to: toEmail, subject, html }).catch((err) =>
        log.error("Specialty waitlist join email failed", { err })
      );
    } catch (err) {
      log.error("Specialty waitlist join email build failed", { err });
    }
  }

  revalidatePath("/admin/waitlist");
  return { success: true };
}

/**
 * Notify specialty waitlist subscribers when any doctor in that specialty opens slots.
 */
export async function notifySpecialtyWaitlist(
  specialtySlug: string,
  doctorName: string,
  doctorSlug: string
): Promise<{ notifiedCount: number }> {
  const admin = createAdminClient();
  const specialtyLabel = specialtySlugToLabel(specialtySlug);

  const { data: alerts, error } = await admin
    .from("specialty_waitlist")
    .select(
      `
      id,
      patient_id,
      guest_email,
      guest_name,
      last_notified_at,
      notify_count,
      unsubscribe_token,
      patient:profiles!specialty_waitlist_patient_id_fkey(first_name, email)
    `
    )
    .eq("specialty_slug", specialtySlug)
    .eq("status", "active");

  if (error || !alerts || alerts.length === 0) {
    if (error && (error as { code?: string }).code !== "42P01") {
      log.error("[SpecialtyWaitlist] Load error:", { err: error });
    }
    return { notifiedCount: 0 };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
  const bookingUrl = `${appUrl}/en/doctors/${doctorSlug}/book`;
  const now = Date.now();
  let notifiedCount = 0;

  for (const alert of alerts) {
    try {
      if (alert.last_notified_at) {
        const last = new Date(alert.last_notified_at).getTime();
        if (now - last < SPECIALTY_NOTIFY_DEBOUNCE_MS) continue;
      }

      const patient: any = Array.isArray(alert.patient)
        ? alert.patient[0]
        : alert.patient;
      const patientName =
        patient?.first_name || alert.guest_name || "there";
      const toEmail = patient?.email || alert.guest_email;

      const unsubUrl = alert.unsubscribe_token
        ? `${appUrl}/en/unsubscribe-waitlist?token=${alert.unsubscribe_token}&type=specialty`
        : undefined;

      if (alert.patient_id) {
        await createNotification({
          userId: alert.patient_id,
          type: "availability_alert",
          title: `${specialtyLabel} now available`,
          message: `${doctorName} (${specialtyLabel}) has new appointment slots. Book before they fill up!`,
          channels: ["in_app"],
          metadata: { specialtySlug, doctorSlug, doctorName },
        });
      }

      if (toEmail) {
        const { subject, html } = specialtyAvailabilityAlertEmail({
          patientName,
          specialtyLabel,
          doctorName,
          bookingUrl,
          unsubscribeUrl: unsubUrl,
        });
        sendEmail({ to: toEmail, subject, html }).catch((err) =>
          log.error("Specialty waitlist email failed", {
            err,
            alertId: alert.id,
          })
        );
      }

      await admin
        .from("specialty_waitlist")
        .update({
          last_notified_at: new Date().toISOString(),
          notify_count: (alert.notify_count || 0) + 1,
        })
        .eq("id", alert.id);

      notifiedCount++;
    } catch (err) {
      log.error("Specialty waitlist notification error", {
        err,
        alertId: alert.id,
      });
    }
  }

  return { notifiedCount };
}

export async function notifySpecialtyWaitlistsForDoctor(
  doctorId: string,
  doctorName: string,
  doctorSlug: string
): Promise<void> {
  const admin = createAdminClient();
  try {
    const { data: specs } = await admin
      .from("doctor_specialties")
      .select("specialty:specialties(slug)")
      .eq("doctor_id", doctorId);

    const slugs = new Set<string>();
    for (const row of specs || []) {
      const s: any = Array.isArray(row.specialty)
        ? row.specialty[0]
        : row.specialty;
      if (s?.slug) slugs.add(s.slug);
    }
    for (const slug of slugs) {
      await notifySpecialtyWaitlist(slug, doctorName, doctorSlug);
    }
  } catch (err) {
    log.error("Specialty waitlist notify for doctor failed", { err, doctorId });
  }
}

export async function unsubscribeSpecialtyWaitlistByToken(
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || token.length < 10) {
    return { success: false, error: "Invalid unsubscribe link." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("specialty_waitlist")
    .update({ status: "unsubscribed", updated_at: new Date().toISOString() })
    .eq("unsubscribe_token", token)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return {
      success: false,
      error: "This unsubscribe link is invalid or expired.",
    };
  }
  return { success: true };
}

/**
 * Admin: specialty demand signals for recruiting (where patients wait).
 */
export async function getSpecialtyDemandForAdmin(): Promise<{
  error?: string;
  rows: Array<{
    id: string;
    specialtySlug: string;
    name: string;
    email: string;
    placeName: string | null;
    countryCode: string | null;
    status: string;
    createdAt: string;
    isGuest: boolean;
  }>;
  summary: Array<{
    specialtySlug: string;
    placeName: string | null;
    countryCode: string | null;
    count: number;
  }>;
  totalActive: number;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated", rows: [], summary: [], totalActive: 0 };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return { error: "Not authorized", rows: [], summary: [], totalActive: 0 };
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("specialty_waitlist")
    .select(
      `
      id, specialty_slug, guest_email, guest_name, patient_id,
      place_name, country_code, status, created_at,
      patient:profiles!specialty_waitlist_patient_id_fkey(first_name, last_name, email)
    `
    )
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    log.error("[SpecialtyWaitlist] Admin load error:", { err: error });
    return { error: "Failed to load demand", rows: [], summary: [], totalActive: 0 };
  }

  const rows = (data || []).map((row) => {
    const patient: any = Array.isArray(row.patient)
      ? row.patient[0]
      : row.patient;
    const isGuest = !row.patient_id;
    const name = isGuest
      ? row.guest_name || "Guest"
      : [patient?.first_name, patient?.last_name].filter(Boolean).join(" ") ||
        "Patient";
    const email = isGuest ? row.guest_email || "" : patient?.email || "";
    return {
      id: row.id,
      specialtySlug: row.specialty_slug,
      name,
      email,
      placeName: row.place_name,
      countryCode: row.country_code,
      status: row.status,
      createdAt: row.created_at,
      isGuest,
    };
  });

  const active = rows.filter((r) => r.status === "active");
  const keyCount = new Map<string, {
    specialtySlug: string;
    placeName: string | null;
    countryCode: string | null;
    count: number;
  }>();
  for (const r of active) {
    const key = `${r.specialtySlug}|${r.placeName || ""}|${r.countryCode || ""}`;
    const prev = keyCount.get(key);
    if (prev) prev.count += 1;
    else {
      keyCount.set(key, {
        specialtySlug: r.specialtySlug,
        placeName: r.placeName,
        countryCode: r.countryCode,
        count: 1,
      });
    }
  }
  const summary = [...keyCount.values()].sort((a, b) => b.count - a.count);

  return { rows, summary, totalActive: active.length };
}

