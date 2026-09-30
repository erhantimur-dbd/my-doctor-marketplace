import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/lib/notifications";
import { sendEmail } from "@/lib/email/client";
import {
  availabilityAlertEmail,
  specialtyAvailabilityAlertEmail,
} from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";
import { specialtySlugToLabel } from "@/lib/constants/related-specialties";

/**
 * Server-only waitlist fan-out. Not a server action: a signed-in caller
 * must not be able to email every subscriber for an arbitrary doctor.
 */

const SPECIALTY_NOTIFY_DEBOUNCE_MS = 24 * 60 * 60 * 1000;

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
