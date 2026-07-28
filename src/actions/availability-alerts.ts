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
import { rateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/utils/logger";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";
import {
  doctorHasWaitlistAutoNotify,
  doctorTierHasWaitlistAutoNotify,
  getDoctorLicense,
} from "@/lib/license/check";
// Pro+ waitlist also aligned with hasFeature("waitlist_auto_notify")

/**
 * Subscribe to notifications when a doctor has new availability.
 * Pro+ doctor licence required (waitlist auto-notify feature).
 */
export async function subscribeToAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be logged in." };

  // Verify doctor exists
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("id", doctorId)
    .single();

  if (!doctor) return { success: false, error: "Doctor not found." };

  // Pro plan only (Phase 4 waitlist auto-notify)
  const eligible = await doctorHasWaitlistAutoNotify(supabase, doctorId);
  if (!eligible) {
    return {
      success: false,
      error:
        "Waitlist alerts are available when this doctor is on a Professional or higher plan.",
    };
  }

  // Insert alert (upsert to avoid duplicates) — re-arm by clearing notified_at
  const { error } = await supabase.from("availability_alerts").upsert(
    {
      patient_id: user.id,
      doctor_id: doctorId,
      notified_at: null,
    },
    { onConflict: "patient_id,doctor_id" }
  );

  if (error) {
    log.error("[AvailabilityAlerts] Subscribe error:", { err: error });
    return { success: false, error: "Failed to subscribe." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Unsubscribe from a doctor's availability notifications.
 */
export async function unsubscribeFromAvailability(
  doctorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "You must be logged in." };

  const { error } = await supabase
    .from("availability_alerts")
    .delete()
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId);

  if (error) {
    log.error("[AvailabilityAlerts] Unsubscribe error:", { err: error });
    return { success: false, error: "Failed to unsubscribe." };
  }

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * Check if the current user is subscribed to a doctor's availability.
 */
export async function getAvailabilityAlert(
  doctorId: string
): Promise<{ subscribed: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { subscribed: false };

  const { data } = await supabase
    .from("availability_alerts")
    .select("id")
    .eq("patient_id", user.id)
    .eq("doctor_id", doctorId)
    .maybeSingle();

  return { subscribed: !!data };
}

/**
 * Notify patients who have subscribed to a doctor's availability.
 * Called when a doctor adds new availability slots.
 * Should be called from a cron job or availability update action.
 */
export async function notifyAvailabilitySubscribers(
  doctorId: string,
  doctorName: string,
  doctorSlug: string
): Promise<{ notifiedCount: number }> {
  const admin = createAdminClient();

  // Specialty waitlist is platform-wide (not Pro-gated) — always try.
  await notifySpecialtyWaitlistsForDoctor(doctorId, doctorName, doctorSlug).catch(
    (err) => log.error("Specialty waitlist fan-out failed", { err, doctorId })
  );

  // Per-doctor waitlist requires Pro+ licence
  const license = await getDoctorLicense(admin, doctorId);
  if (!doctorTierHasWaitlistAutoNotify(license?.tier)) {
    return { notifiedCount: 0 };
  }

  // Fetch un-notified alerts with patient profile for email
  const { data: alerts } = await admin
    .from("availability_alerts")
    .select("id, patient_id, patient:profiles!availability_alerts_patient_id_fkey(first_name, email)")
    .eq("doctor_id", doctorId)
    .is("notified_at", null);

  if (!alerts || alerts.length === 0) return { notifiedCount: 0 };

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com"}/en/doctors/${doctorSlug}/book`;
  let notifiedCount = 0;

  for (const alert of alerts) {
    try {
      const patient: any = Array.isArray(alert.patient) ? alert.patient[0] : alert.patient;

      // In-app notification
      await createNotification({
        userId: alert.patient_id,
        type: "availability_alert",
        title: "Doctor Now Available",
        message: `${doctorName} has new appointment slots available. Book now before they fill up!`,
        channels: ["in_app", "email"],
        metadata: {
          doctorId,
          doctorSlug,
          doctorName,
        },
      });

      // Email notification
      if (patient?.email) {
        const { subject, html } = availabilityAlertEmail({
          patientName: patient.first_name || "there",
          doctorName,
          bookingUrl,
        });
        sendEmail({ to: patient.email, subject, html }).catch((err) =>
          log.error("Availability alert email failed", { err, patientId: alert.patient_id })
        );
      }

      // Mark as notified
      await admin
        .from("availability_alerts")
        .update({ notified_at: new Date().toISOString() })
        .eq("id", alert.id);

      notifiedCount++;
    } catch (err) {
      log.error("Availability alert notification error", { err, patientId: alert.patient_id });
    }
  }

  return { notifiedCount };
}


// ── Specialty-level waitlist ──────────────────────────────────────

const SPECIALTY_NOTIFY_DEBOUNCE_MS = 24 * 60 * 60 * 1000; // 24h

export interface JoinSpecialtyWaitlistInput {
  specialtySlug: string;
  email?: string;
  name?: string;
  countryCode?: string;
  consultationType?: "in_person" | "video" | null;
}

/**
 * Join a specialty waitlist (e.g. dermatology). Guests need email + name.
 * Not Pro-gated — this is patient demand signal for the platform.
 */
export async function joinSpecialtyWaitlist(
  input: JoinSpecialtyWaitlistInput
): Promise<{ success: boolean; error?: string }> {
  const { specialtySlug, email, name, countryCode, consultationType } = input;

  if (!specialtySlug) {
    return { success: false, error: "Specialty is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const guestEmail = email?.trim().toLowerCase() || null;
  const guestName = name?.trim() || null;

  if (!user && !guestEmail) {
    return {
      success: false,
      error: "Please enter your email to join the waitlist.",
    };
  }
  if (!user && guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return { success: false, error: "Please enter a valid email address." };
  }
  if (!user && !guestName) {
    return { success: false, error: "Please enter your name." };
  }

  if (!user && guestEmail) {
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
    guest_name: user ? null : guestName,
    country_code: countryCode || null,
    consultation_type: consultationType || null,
    status: "active",
    last_notified_at: null,
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
      ({ error } = await admin.from("specialty_waitlist").insert(row));
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
      ({ error } = await admin.from("specialty_waitlist").insert(row));
    }
  }

  if (error) {
    log.error("[SpecialtyWaitlist] Join error:", { err: error });
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "42P01"
    ) {
      return {
        success: false,
        error: "Waitlist is temporarily unavailable. Please try again later.",
      };
    }
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
    const searchUrl = `${appUrl}/en-GB/doctors?specialty=${encodeURIComponent(specialtySlug)}&sort=soonest`;
    try {
      const { subject, html } = specialtyWaitlistJoinedEmail({
        patientName: toName,
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

  revalidatePath("/", "layout");
  revalidatePath("/dashboard/alerts");
  return { success: true };
}

/**
 * Notify specialty waitlist subscribers when any doctor in that specialty
 * opens slots. Debounced 24h per alert.
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
  const bookingUrl = `${appUrl}/en-GB/doctors/${doctorSlug}/book`;
  const now = Date.now();
  let notifiedCount = 0;

  for (const alert of alerts) {
    try {
      if (alert.last_notified_at) {
        const last = new Date(alert.last_notified_at).getTime();
        if (now - last < SPECIALTY_NOTIFY_DEBOUNCE_MS) continue;
      }

      const patient = Array.isArray(alert.patient)
        ? alert.patient[0]
        : alert.patient;
      const patientName =
        (patient as { first_name?: string } | null)?.first_name ||
        alert.guest_name ||
        "there";
      const toEmail =
        (patient as { email?: string } | null)?.email || alert.guest_email;

      const unsubUrl = alert.unsubscribe_token
        ? `${appUrl}/en-GB/unsubscribe-waitlist?token=${alert.unsubscribe_token}&type=specialty`
        : undefined;

      if (alert.patient_id) {
        await createNotification({
          userId: alert.patient_id,
          type: "availability_alert",
          title: `${specialtyLabel} now available`,
          message: `${doctorName} (${specialtyLabel}) has new appointment slots. Book before they fill up!`,
          channels: ["in_app", "email"],
          metadata: {
            specialtySlug,
            doctorSlug,
            doctorName,
          },
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

/**
 * After a doctor opens slots, also notify specialty waitlists for their specialties.
 */
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
      const s = Array.isArray(row.specialty) ? row.specialty[0] : row.specialty;
      const slug = (s as { slug?: string } | null)?.slug;
      if (slug) slugs.add(slug);
    }
    for (const slug of slugs) {
      await notifySpecialtyWaitlist(slug, doctorName, doctorSlug);
    }
  } catch (err) {
    log.error("Specialty waitlist notify for doctor failed", { err, doctorId });
  }
}

/**
 * Public unsubscribe for specialty waitlist via token.
 */
export async function unsubscribeSpecialtyWaitlistByToken(
  token: string
): Promise<{ success: boolean; error?: string }> {
  if (!token) return { success: false, error: "Invalid link." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("specialty_waitlist")
    .update({ status: "unsubscribed" })
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

/** Public unsubscribe via token (specialty waitlist). */
export async function unsubscribeByToken(
  token: string
): Promise<{ success: boolean; error?: string }> {
  return unsubscribeSpecialtyWaitlistByToken(token);
}
