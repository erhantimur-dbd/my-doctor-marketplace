"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { safeError } from "@/lib/utils/safe-error";
import { subscriptionUpgradeInviteEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";
import { getStripe } from "@/lib/stripe/client";
import { getBookingFeeCents } from "@/lib/utils/currency";
import { BOOKING_STATUSES } from "@/lib/constants/booking-status";
import { sendEmail } from "@/lib/email/client";
import {
  adminBookingPaymentLinkEmail,
  bookingCancellationEmail,
} from "@/lib/email/templates";
import { removeBookingFromGoogleCalendar } from "@/lib/google/sync";
import { removeBookingFromMicrosoftCalendar } from "@/lib/microsoft/sync";
import { removeBookingFromCalDAV } from "@/lib/caldav/sync";
import { deleteRoom } from "@/lib/daily/client";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/client";
import {
  TEMPLATE_BOOKING_CANCELLATION,
  buildBookingCancellationComponents,
  mapLocaleToWhatsApp,
} from "@/lib/whatsapp/templates";
import { headers } from "next/headers";

// Admin email allowlist — mirrors middleware check for defense-in-depth
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, user: null };

  // Check email allowlist (if configured)
  if (
    ADMIN_EMAILS.length > 0 &&
    !ADMIN_EMAILS.includes(user.email?.toLowerCase() || "")
  ) {
    return { error: "Not authorized", supabase: null, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin")
    return { error: "Not authorized", supabase: null, user: null };

  return { error: null, supabase, user };
}

async function logAdminAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  action: string,
  targetType: string,
  targetId: string,
  metadata?: Record<string, unknown>
) {
  await supabase.from("audit_log").insert({
    actor_id: userId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata: metadata || {},
  });
}

// ===================== Approval Checklist =====================

export async function getApprovalChecklist(doctorId: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, data: null };

  const { data, error } = await supabase
    .from("doctor_approval_checklist")
    .select("*")
    .eq("doctor_id", doctorId)
    .maybeSingle();

  if (error) return { error: safeError(error), data: null };
  return { data };
}

export async function saveApprovalChecklist(
  doctorId: string,
  values: {
    gmc_verified: boolean;
    website_verified: boolean;
    notes?: string;
  }
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const allComplete = values.gmc_verified && values.website_verified;

  const { error } = await supabase
    .from("doctor_approval_checklist")
    .upsert(
      {
        doctor_id: doctorId,
        reviewer_id: user.id,
        gmc_verified: values.gmc_verified,
        website_verified: values.website_verified,
        notes: values.notes || null,
        completed_at: allComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "doctor_id" }
    );

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "approval_checklist_updated", "doctor", doctorId, {
    gmc_verified: values.gmc_verified,
    website_verified: values.website_verified,
    complete: allComplete,
  });

  revalidatePath(`/admin/doctors/${doctorId}`);
  revalidatePath("/admin/approvals");
  return { success: true };
}

// ===================== Doctor Verification =====================

export async function updateDoctorVerification(
  doctorId: string,
  status: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // When verifying, require completed approval checklist
  if (status === "verified") {
    const { data: checklist } = await supabase
      .from("doctor_approval_checklist")
      .select("gmc_verified, website_verified")
      .eq("doctor_id", doctorId)
      .maybeSingle();

    if (!checklist || !checklist.gmc_verified || !checklist.website_verified) {
      return { error: "Complete the approval checklist before verifying this doctor." };
    }
  }

  const updateData: Record<string, unknown> = {
    verification_status: status,
  };
  if (status === "verified") {
    updateData.verified_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, `doctor_verification_${status}`, "doctor", doctorId);

  // Send email notification on verification or rejection
  if (status === "verified" || status === "rejected") {
    const { data: doctor } = await supabase
      .from("doctors")
      .select("profile_id, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)")
      .eq("id", doctorId)
      .single();

    if (doctor) {
      const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
      const doctorName = `${profile.first_name} ${profile.last_name}`;

      if (status === "verified") {
        const { doctorVerifiedEmail } = await import("@/lib/email/templates");
        const { subject, html } = doctorVerifiedEmail({ doctorName });
        await createNotification({
          userId: doctor.profile_id,
          type: "doctor_verified",
          title: "Account Verified",
          message: "Your GMC registration has been verified. Your profile is now live!",
          channels: ["in_app", "email"],
          email: { to: profile.email, subject, html },
        });
      } else {
        const { doctorRejectedEmail } = await import("@/lib/email/templates");
        const { subject, html } = doctorRejectedEmail({ doctorName });
        await createNotification({
          userId: doctor.profile_id,
          type: "doctor_rejected",
          title: "Verification Unsuccessful",
          message: "We were unable to verify your GMC registration. Please contact support.",
          channels: ["in_app", "email"],
          email: { to: profile.email, subject, html },
        });
      }
    }
  }

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorActive(doctorId: string, isActive: boolean) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("doctors")
    .update({ is_active: isActive })
    .eq("id", doctorId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, isActive ? "doctor_activated" : "doctor_deactivated", "doctor", doctorId);

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function toggleDoctorFeatured(
  doctorId: string,
  isFeatured: boolean
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const updateData: Record<string, unknown> = {
    is_featured: isFeatured,
  };
  if (isFeatured) {
    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + 30);
    updateData.featured_until = featuredUntil.toISOString();
  } else {
    updateData.featured_until = null;
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, isFeatured ? "doctor_featured" : "doctor_unfeatured", "doctor", doctorId);

  revalidatePath("/admin/doctors");
  return { success: true };
}

export async function approveReview(reviewId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: true })
    .eq("id", reviewId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "review_approved", "review", reviewId);

  revalidatePath("/admin/reviews");
  return { success: true };
}

export async function hideReview(reviewId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: false })
    .eq("id", reviewId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "review_hidden", "review", reviewId);

  revalidatePath("/admin/reviews");
  return { success: true };
}

/** @deprecated Use hideReview instead */
export async function deleteReview(reviewId: string) {
  return hideReview(reviewId);
}

export async function updatePlatformSetting(key: string, value: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "setting_updated", "platform_setting", key, { value });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function updateAdminProfile(firstName: string, lastName: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    })
    .eq("id", user.id);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "profile_updated", "profile", user.id, {
    first_name: firstName.trim(),
    last_name: lastName.trim(),
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

export async function sendUpgradeInvite(doctorId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // Fetch doctor with profile
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, profile:profiles!doctors_profile_id_fkey(id, first_name, last_name, email)")
    .eq("id", doctorId)
    .single();

  if (!doctor) return { error: "Doctor not found" };

  // Check they don't already have an active license
  const { hasActiveLicense } = await import("@/lib/license/check");
  if (await hasActiveLicense(supabase, doctorId)) {
    return { error: "Doctor already has an active subscription" };
  }

  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const { subject, html } = subscriptionUpgradeInviteEmail({
    doctorName: `${profile.first_name} ${profile.last_name}`,
    subscriptionUrl: `${appUrl}/en/doctor-dashboard/subscription`,
  });

  // Send in-app notification + email
  await createNotification({
    userId: profile.id,
    type: "subscription_upgrade_invite",
    title: "Upgrade to Professional",
    message: "Unlock the full suite of tools to manage your practice and reach more patients.",
    channels: ["in_app", "email"],
    metadata: { invitedBy: user.id, plan: "professional" },
    email: { to: profile.email, subject, html },
  });

  await logAdminAction(supabase, user.id, "subscription_upgrade_invite_sent", "doctor", doctorId, { plan: "professional" });

  revalidatePath("/admin/doctors");
  return { success: true };
}

// ===================== Patient Management =====================

export async function adminResetPatientPassword(patientId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // Fetch patient email
  const { data: patient } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", patientId)
    .single();

  if (!patient?.email) return { error: "Patient not found or has no email" };

  // Send password reset email via Supabase Auth
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    patient.email,
    { redirectTo: `${appUrl}/en/reset-password` }
  );

  if (resetError) return { error: safeError(resetError) };

  await logAdminAction(
    supabase,
    user.id,
    "patient_password_reset",
    "patient",
    patientId,
    { email: patient.email }
  );

  revalidatePath(`/admin/patients/${patientId}`);
  return { success: true };
}

// ===================== Coupon Management =====================

export async function createCoupon(data: {
  code: string;
  name: string;
  description?: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  currency?: string;
  applicable_plans?: string[] | null;
  duration?: "once" | "repeating" | "forever";
  duration_in_months?: number;
  max_uses?: number | null;
  valid_from?: string;
  expires_at?: string | null;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const code = data.code.toUpperCase().trim();
  if (!code || code.length < 3) return { error: "Code must be at least 3 characters" };

  if (data.discount_type === "percentage" && (data.discount_value < 1 || data.discount_value > 100)) {
    return { error: "Percentage must be between 1 and 100" };
  }
  if (data.discount_type === "fixed_amount" && data.discount_value < 1) {
    return { error: "Amount must be positive" };
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from("coupons")
    .select("id")
    .eq("code", code)
    .maybeSingle();
  if (existing) return { error: "A coupon with this code already exists" };

  // Create Stripe coupon
  const { getStripe } = await import("@/lib/stripe/client");
  const stripe = getStripe();

  const stripeCouponParams: Record<string, unknown> = {
    name: data.name,
    duration: data.duration || "once",
  };
  if (data.discount_type === "percentage") {
    stripeCouponParams.percent_off = data.discount_value;
  } else {
    stripeCouponParams.amount_off = data.discount_value;
    stripeCouponParams.currency = (data.currency || "eur").toLowerCase();
  }
  if (data.duration === "repeating" && data.duration_in_months) {
    stripeCouponParams.duration_in_months = data.duration_in_months;
  }
  if (data.max_uses) {
    stripeCouponParams.max_redemptions = data.max_uses;
  }
  if (data.expires_at) {
    stripeCouponParams.redeem_by = Math.floor(new Date(data.expires_at).getTime() / 1000);
  }

  let stripeCoupon;
  try {
    stripeCoupon = await stripe.coupons.create(stripeCouponParams as any);
  } catch (err: any) {
    return { error: safeError(err) };
  }

  // Insert into DB
  const { error: insertError } = await supabase.from("coupons").insert({
    code,
    name: data.name,
    description: data.description || null,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
    currency: data.currency || "EUR",
    applicable_plans: data.applicable_plans || null,
    duration: data.duration || "once",
    duration_in_months: data.duration_in_months || null,
    max_uses: data.max_uses || null,
    valid_from: data.valid_from || new Date().toISOString(),
    expires_at: data.expires_at || null,
    is_active: true,
    stripe_coupon_id: stripeCoupon.id,
    created_by: user.id,
  });

  if (insertError) return { error: safeError(insertError) };

  await logAdminAction(supabase, user.id, "coupon_created", "coupon", code, {
    name: data.name,
    discount_type: data.discount_type,
    discount_value: data.discount_value,
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function toggleCouponActive(couponId: string, isActive: boolean) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { error } = await supabase
    .from("coupons")
    .update({ is_active: isActive })
    .eq("id", couponId);

  if (error) return { error: safeError(error) };

  await logAdminAction(
    supabase,
    user.id,
    isActive ? "coupon_activated" : "coupon_deactivated",
    "coupon",
    couponId
  );

  revalidatePath("/admin/coupons");
  return { success: true };
}

export async function deleteCoupon(couponId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: coupon } = await supabase
    .from("coupons")
    .select("stripe_coupon_id, code")
    .eq("id", couponId)
    .single();

  if (!coupon) return { error: "Coupon not found" };

  // Delete from Stripe
  if (coupon.stripe_coupon_id) {
    try {
      const { getStripe } = await import("@/lib/stripe/client");
      await getStripe().coupons.del(coupon.stripe_coupon_id);
    } catch (err) {
      console.error("[Coupon] Failed to delete Stripe coupon:", err);
    }
  }

  // Soft delete — deactivate to preserve redemption history
  const { error } = await supabase
    .from("coupons")
    .update({ is_active: false })
    .eq("id", couponId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "coupon_deleted", "coupon", couponId, {
    code: coupon.code,
  });

  revalidatePath("/admin/coupons");
  return { success: true };
}

// ===================== Booking Actions =====================

export async function adminRefundBooking(
  bookingId: string,
  amountCents?: number,
  reason?: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, total_amount_cents, stripe_payment_intent_id, paid_at, refunded_at, currency")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found" };
  if (!booking.paid_at) return { error: "Booking has not been paid" };
  if (booking.refunded_at) return { error: "Booking has already been refunded" };
  if (!booking.stripe_payment_intent_id) return { error: "No Stripe payment intent found" };

  const refundAmount = amountCents || booking.total_amount_cents;
  if (refundAmount <= 0 || refundAmount > booking.total_amount_cents) {
    return { error: "Invalid refund amount" };
  }

  try {
    const { getStripe } = await import("@/lib/stripe/client");
    await getStripe().refunds.create({
      payment_intent: booking.stripe_payment_intent_id,
      amount: refundAmount,
      reverse_transfer: true,
      refund_application_fee: true,
    } as any);
  } catch (err: any) {
    return { error: safeError(err) };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_amount_cents: refundAmount,
    })
    .eq("id", bookingId);

  if (updateError) return { error: safeError(updateError) };

  await logAdminAction(supabase, user.id, "booking_refunded", "booking", bookingId, {
    amount_cents: refundAmount,
    reason,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  return { success: true };
}

export async function adminUpdateBookingStatus(
  bookingId: string,
  newStatus: string,
  reason?: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending_approval: ["approved", "rejected"],
    confirmed: ["completed", "no_show", "cancelled_doctor"],
    approved: ["completed", "no_show", "cancelled_doctor"],
  };

  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found" };

  const allowed = ALLOWED_TRANSITIONS[booking.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return { error: `Cannot transition from ${booking.status} to ${newStatus}` };
  }

  const updateData: Record<string, unknown> = { status: newStatus };
  if (newStatus === "completed") {
    updateData.completed_at = new Date().toISOString();
  }
  if (reason) {
    updateData.cancellation_reason = reason;
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId);

  if (updateError) return { error: safeError(updateError) };

  await logAdminAction(supabase, user.id, `booking_status_${newStatus}`, "booking", bookingId, {
    from: booking.status,
    to: newStatus,
    reason,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  return { success: true };
}

// ===================== Patient Suspension =====================

export async function adminTogglePatientSuspension(
  patientId: string,
  suspend: boolean
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();

  try {
    const { error: banError } = await adminSupabase.auth.admin.updateUserById(
      patientId,
      { ban_duration: suspend ? "876000h" : "none" }
    );
    if (banError) return { error: safeError(banError) };
  } catch (err: any) {
    return { error: safeError(err) };
  }

  await logAdminAction(
    supabase,
    user.id,
    suspend ? "patient_suspended" : "patient_unsuspended",
    "patient",
    patientId
  );

  revalidatePath(`/admin/patients/${patientId}`);
  return { success: true };
}

// ===================== Doctor Profile Editing =====================

export async function adminUpdateDoctorProfile(
  doctorId: string,
  fields: Record<string, unknown>
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const ALLOWED_FIELDS = [
    "consultation_fee_cents",
    "video_consultation_fee_cents",
    "bio",
    "languages",
    "years_of_experience",
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of ALLOWED_FIELDS) {
    if (key in fields) {
      updateData[key] = fields[key];
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No valid fields to update" };
  }

  const { error } = await supabase
    .from("doctors")
    .update(updateData)
    .eq("id", doctorId);

  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "doctor_profile_updated", "doctor", doctorId, {
    fields: Object.keys(updateData),
  });

  revalidatePath(`/admin/doctors/${doctorId}`);
  revalidatePath("/admin/doctors");
  return { success: true };
}

// ===================== CSV Export Actions =====================

// ===================== Bulk Review Moderation =====================

export async function adminBulkModerateReviews(
  reviewIds: string[],
  action: "approve" | "hide"
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  if (!reviewIds.length || reviewIds.length > 100) {
    return { error: "Select between 1 and 100 reviews" };
  }

  const isVisible = action === "approve";

  const { error } = await supabase
    .from("reviews")
    .update({ is_visible: isVisible })
    .in("id", reviewIds);

  if (error) return { error: safeError(error) };

  // Log each action
  for (const id of reviewIds) {
    await logAdminAction(
      supabase,
      user.id,
      action === "approve" ? "review_approved" : "review_hidden",
      "review",
      id,
      { bulk: true }
    );
  }

  revalidatePath("/admin/reviews");
  return { success: true };
}

// ===================== Admin Email =====================

export async function adminSendEmail(
  userId: string,
  subject: string,
  message: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  if (!subject.trim() || !message.trim()) {
    return { error: "Subject and message are required" };
  }

  // Fetch recipient profile
  const { data: recipient } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("id", userId)
    .single();

  if (!recipient?.email) return { error: "User not found or has no email" };

  const recipientName = `${recipient.first_name || ""} ${recipient.last_name || ""}`.trim();

  const { adminMessageEmail } = await import("@/lib/email/templates");
  const { subject: emailSubject, html } = adminMessageEmail({
    recipientName,
    subject,
    message,
  });

  const { sendEmail } = await import("@/lib/email/client");
  try {
    await sendEmail({ to: recipient.email, subject: emailSubject, html });
  } catch (err: any) {
    return { error: safeError(err) };
  }

  await logAdminAction(supabase, user.id, "admin_email_sent", "user", userId, {
    subject,
    recipientEmail: recipient.email,
  });

  return { success: true };
}

// ===================== CSV Export Actions =====================

export async function exportBookingsCSV() {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, headers: [], rows: [] };

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `booking_number, appointment_date, start_time, status, consultation_type,
       total_amount_cents, platform_fee_cents, currency,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name, email),
       doctor:doctors!inner(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("appointment_date", { ascending: false })
    .limit(5000);

  const headers = [
    "Booking #", "Date", "Time", "Status", "Type",
    "Patient", "Patient Email", "Doctor",
    "Amount", "Platform Fee", "Currency",
  ];
  const rows = (bookings || []).map((b: any) => [
    b.booking_number,
    b.appointment_date,
    b.start_time?.slice(0, 5),
    b.status,
    b.consultation_type,
    `${b.patient?.first_name || ""} ${b.patient?.last_name || ""}`.trim(),
    b.patient?.email || "",
    `${b.doctor?.profile?.first_name || ""} ${b.doctor?.profile?.last_name || ""}`.trim(),
    (b.total_amount_cents / 100).toFixed(2),
    (b.platform_fee_cents / 100).toFixed(2),
    b.currency,
  ]);

  return { headers, rows };
}

export async function exportPatientsCSV() {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, headers: [], rows: [] };

  const { data: patients } = await supabase
    .from("profiles")
    .select("first_name, last_name, email, phone, city, country, created_at")
    .eq("role", "patient")
    .order("created_at", { ascending: false })
    .limit(10000);

  const headers = ["First Name", "Last Name", "Email", "Phone", "City", "Country", "Joined"];
  const rows = (patients || []).map((p: any) => [
    p.first_name, p.last_name, p.email, p.phone || "", p.city || "", p.country || "",
    new Date(p.created_at).toISOString().split("T")[0],
  ]);

  return { headers, rows };
}

// ===================== License Management =====================

export async function adminOverrideLicenseStatus(
  licenseId: string,
  newStatus: string,
  reason: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  if (!reason.trim()) return { error: "Reason is required" };

  const { data: license } = await supabase
    .from("licenses")
    .select("id, status, stripe_subscription_id")
    .eq("id", licenseId)
    .single();
  if (!license) return { error: "License not found" };
  if (license.status === newStatus) return { error: "Already in this status" };

  const updateData: Record<string, unknown> = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === "suspended") {
    updateData.suspended_at = new Date().toISOString();
  } else if (newStatus === "cancelled") {
    updateData.cancelled_at = new Date().toISOString();
  } else if (newStatus === "grace_period") {
    updateData.grace_period_start = new Date().toISOString();
  } else if (newStatus === "active") {
    updateData.suspended_at = null;
    updateData.grace_period_start = null;
    updateData.cancelled_at = null;
  }

  const { error } = await supabase
    .from("licenses")
    .update(updateData)
    .eq("id", licenseId);
  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, `license_status_${newStatus}`, "license", licenseId, {
    from: license.status,
    to: newStatus,
    reason,
    had_stripe: !!license.stripe_subscription_id,
  });

  revalidatePath(`/admin/licenses/${licenseId}`);
  revalidatePath("/admin/licenses");
  return { success: true };
}

export async function adminChangeLicenseTier(
  licenseId: string,
  newTier: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: license } = await supabase
    .from("licenses")
    .select("id, tier, max_seats")
    .eq("id", licenseId)
    .single();
  if (!license) return { error: "License not found" };
  if (license.tier === newTier) return { error: "Already on this tier" };

  const { getLicenseTier } = await import("@/lib/constants/license-tiers");
  const tierConfig = getLicenseTier(newTier);
  if (!tierConfig) return { error: "Invalid tier" };

  const { error } = await supabase
    .from("licenses")
    .update({
      tier: newTier,
      max_seats: Math.max(license.max_seats, tierConfig.defaultSeats),
      updated_at: new Date().toISOString(),
    })
    .eq("id", licenseId);
  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "license_tier_changed", "license", licenseId, {
    from: license.tier,
    to: newTier,
  });

  revalidatePath(`/admin/licenses/${licenseId}`);
  revalidatePath("/admin/licenses");
  return { success: true };
}

export async function adminAdjustLicenseSeats(
  licenseId: string,
  maxSeats: number,
  extraSeatCount: number
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: license } = await supabase
    .from("licenses")
    .select("id, max_seats, extra_seat_count, used_seats")
    .eq("id", licenseId)
    .single();
  if (!license) return { error: "License not found" };
  if (maxSeats < license.used_seats) {
    return { error: `Cannot reduce below current usage (${license.used_seats} seats in use)` };
  }

  const { error } = await supabase
    .from("licenses")
    .update({
      max_seats: maxSeats,
      extra_seat_count: extraSeatCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", licenseId);
  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "license_seats_adjusted", "license", licenseId, {
    old_max: license.max_seats,
    new_max: maxSeats,
    old_extra: license.extra_seat_count,
    new_extra: extraSeatCount,
  });

  revalidatePath(`/admin/licenses/${licenseId}`);
  revalidatePath("/admin/licenses");
  return { success: true };
}

export async function adminExtendLicensePeriod(
  licenseId: string,
  newPeriodEnd: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: license } = await supabase
    .from("licenses")
    .select("id, current_period_end")
    .eq("id", licenseId)
    .single();
  if (!license) return { error: "License not found" };

  const newEnd = new Date(newPeriodEnd);
  if (isNaN(newEnd.getTime())) return { error: "Invalid date" };
  if (newEnd <= new Date()) return { error: "New end date must be in the future" };

  const { error } = await supabase
    .from("licenses")
    .update({
      current_period_end: newEnd.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", licenseId);
  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "license_period_extended", "license", licenseId, {
    old_end: license.current_period_end,
    new_end: newEnd.toISOString(),
  });

  revalidatePath(`/admin/licenses/${licenseId}`);
  revalidatePath("/admin/licenses");
  return { success: true };
}

export async function adminCreateLicense(data: {
  organization_id: string;
  tier: string;
  status: "active" | "trialing";
  max_seats: number;
  trial_days?: number;
  is_promotional?: boolean;
  promo_note?: string;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", data.organization_id)
    .single();
  if (!org) return { error: "Organization not found" };

  // Check no existing non-cancelled license
  const { data: existing } = await supabase
    .from("licenses")
    .select("id, status")
    .eq("organization_id", data.organization_id)
    .not("status", "eq", "cancelled")
    .limit(1)
    .maybeSingle();
  if (existing) return { error: `Organization already has a license (${existing.status})` };

  const now = new Date();
  const periodEnd = new Date(now);
  const trialDays = data.trial_days || 30;
  periodEnd.setDate(periodEnd.getDate() + trialDays);

  const metadata: Record<string, unknown> = { created_by_admin: user.id };
  if (data.is_promotional) {
    metadata.is_promotional = true;
    if (data.promo_note) metadata.promo_note = data.promo_note;
  }

  const insertData: Record<string, unknown> = {
    organization_id: data.organization_id,
    tier: data.tier,
    status: data.status,
    max_seats: data.max_seats,
    used_seats: 0,
    extra_seat_count: 0,
    current_period_start: now.toISOString(),
    current_period_end: periodEnd.toISOString(),
    metadata,
  };
  if (data.status === "trialing") {
    insertData.trial_ends_at = periodEnd.toISOString();
  }

  const { data: newLicense, error } = await supabase
    .from("licenses")
    .insert(insertData)
    .select("id")
    .single();
  if (error) return { error: safeError(error) };

  await logAdminAction(supabase, user.id, "license_created", "license", newLicense.id, {
    organization_id: data.organization_id,
    org_name: org.name,
    tier: data.tier,
    status: data.status,
    trial_days: trialDays,
    is_promotional: !!data.is_promotional,
  });

  revalidatePath("/admin/licenses");
  revalidatePath("/admin/organizations");
  return { success: true, licenseId: newLicense.id };
}

/**
 * Grant a trial or complimentary subscription directly to a doctor.
 * Creates a license on the doctor's organization.
 */
export async function adminGrantDoctorSubscription(data: {
  doctorId: string;
  tier: "starter" | "professional" | "clinic";
  durationDays: number;
  status: "active" | "trialing";
  promoNote?: string;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  // Look up doctor and their organization
  const adminDb = createAdminClient();
  const { data: doctor } = await adminDb
    .from("doctors")
    .select("id, organization_id, profile:profiles!doctors_profile_id_fkey(first_name, last_name)")
    .eq("id", data.doctorId)
    .single();
  if (!doctor) return { error: "Doctor not found" };

  const doc: any = doctor;
  if (!doc.organization_id) {
    return { error: "Doctor has no organization. Please create one first." };
  }

  // Determine max_seats from tier defaults
  const seatDefaults: Record<string, number> = {
    starter: 1,
    professional: 1,
    clinic: 5,
  };

  // Create license via the existing function logic (inline to handle legacy compat)
  const { data: org } = await adminDb
    .from("organizations")
    .select("id, name")
    .eq("id", doc.organization_id)
    .single();
  if (!org) return { error: "Organization not found" };

  // Check for existing non-cancelled license
  const { data: existing } = await adminDb
    .from("licenses")
    .select("id, status, tier")
    .eq("organization_id", doc.organization_id)
    .not("status", "eq", "cancelled")
    .limit(1)
    .maybeSingle();

  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setDate(periodEnd.getDate() + data.durationDays);

  const metadata: Record<string, unknown> = {
    created_by_admin: user.id,
    is_promotional: true,
    promo_note: data.promoNote || "Admin-granted subscription",
  };

  let licenseId: string;

  if (existing) {
    // Update existing license instead of blocking
    const updateData: Record<string, unknown> = {
      tier: data.tier,
      status: data.status,
      max_seats: seatDefaults[data.tier] || 1,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      cancel_at_period_end: false,
      metadata,
    };
    if (data.status === "trialing") {
      updateData.trial_ends_at = periodEnd.toISOString();
    }

    const { error: updateError } = await adminDb
      .from("licenses")
      .update(updateData)
      .eq("id", existing.id);
    if (updateError) return { error: safeError(updateError) };
    licenseId = existing.id;
  } else {
    // Create new license
    const insertData: Record<string, unknown> = {
      organization_id: doc.organization_id,
      tier: data.tier,
      status: data.status,
      max_seats: seatDefaults[data.tier] || 1,
      used_seats: 0,
      extra_seat_count: 0,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      metadata,
    };
    if (data.status === "trialing") {
      insertData.trial_ends_at = periodEnd.toISOString();
    }

    const { data: newLicense, error: licenseError } = await adminDb
      .from("licenses")
      .insert(insertData)
      .select("id")
      .single();
    if (licenseError) return { error: safeError(licenseError) };
    licenseId = newLicense.id;
  }

  const doctorName = `${doc.profile.first_name} ${doc.profile.last_name}`;

  await logAdminAction(supabase, user.id, "subscription_granted", "doctor", data.doctorId, {
    tier: data.tier,
    status: data.status,
    duration_days: data.durationDays,
    is_promotional: true,
    promo_note: data.promoNote || "",
    license_id: licenseId,
    doctor_name: doctorName,
  });

  revalidatePath(`/admin/doctors/${data.doctorId}`);
  revalidatePath("/admin/doctors");
  revalidatePath("/admin/licenses");
  return { success: true, licenseId, tier: data.tier };
}

// ===================== CSV Export Actions =====================

// ===================== Admin Booking on Behalf =====================

/** Derive origin + locale from incoming request headers. */
async function getOriginAndLocale() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referer = h.get("referer") || "";
  const localeMatch = referer.match(/\/(en|de|tr|fr)(\/|$)/);
  const locale = localeMatch ? localeMatch[1] : "en";
  return { origin, locale };
}

export async function adminSearchPatients(query: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, data: [] };

  if (!query || query.length < 2) return { data: [] };

  const q = `%${query}%`;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email, phone")
    .eq("role", "patient")
    .or(`email.ilike.${q},first_name.ilike.${q},last_name.ilike.${q},phone.ilike.${q}`)
    .limit(10);

  if (error) return { error: safeError(error), data: [] };
  return { data: data || [] };
}

export async function adminCreatePatient(input: {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const adminSupabase = createAdminClient();

  // Check if email already exists
  const { data: existing } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("email", input.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    return {
      error: "A patient with this email already exists.",
      existingPatient: existing,
    };
  }

  // Create user via admin API
  const { data: authData, error: authCreateError } =
    await adminSupabase.auth.admin.createUser({
      email: input.email.toLowerCase(),
      email_confirm: true,
      user_metadata: {
        first_name: input.first_name,
        last_name: input.last_name,
        role: "patient",
      },
    });

  if (authCreateError || !authData.user) {
    return { error: safeError(authCreateError) || "Failed to create user." };
  }

  // Wait for handle_new_user trigger to create profile
  let profileReady = false;
  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: profile } = await adminSupabase
      .from("profiles")
      .select("id")
      .eq("id", authData.user.id)
      .maybeSingle();

    if (profile) {
      profileReady = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Fallback: create profile manually
  if (!profileReady) {
    await adminSupabase.from("profiles").insert({
      id: authData.user.id,
      role: "patient",
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email.toLowerCase(),
    });
  } else {
    // Update profile with provided details
    await adminSupabase
      .from("profiles")
      .update({
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone || null,
      })
      .eq("id", authData.user.id);
  }

  // Send password reset so patient can set their password later
  await adminSupabase.auth.admin.generateLink({
    type: "recovery",
    email: input.email.toLowerCase(),
  });

  await logAdminAction(supabase, user.id, "patient_created", "profile", authData.user.id, {
    email: input.email,
    name: `${input.first_name} ${input.last_name}`,
  });

  return {
    success: true,
    patient: {
      id: authData.user.id,
      first_name: input.first_name,
      last_name: input.last_name,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
    },
  };
}

export async function adminSearchDoctors(query: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, data: [] };

  if (!query || query.length < 2) return { data: [] };

  const adminSupabase = createAdminClient();
  const q = `%${query}%`;

  const { data, error } = await adminSupabase
    .from("doctors")
    .select(
      `id, slug, consultation_fee_cents, video_consultation_fee_cents, base_currency,
       consultation_types, stripe_account_id, stripe_onboarding_complete, is_active,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)`
    )
    .eq("verification_status", "verified")
    .eq("is_active", true);

  if (error) return { error: safeError(error), data: [] };

  // Client-side filter by name/email since we need to search across joined profile
  const filtered = (data || []).filter((d: any) => {
    const profile: any = Array.isArray(d.profile) ? d.profile[0] : d.profile;
    if (!profile) return false;
    const searchStr =
      `${profile.first_name} ${profile.last_name} ${profile.email}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  });

  return {
    data: filtered.slice(0, 10).map((d: any) => {
      const profile: any = Array.isArray(d.profile) ? d.profile[0] : d.profile;
      return {
        id: d.id,
        slug: d.slug,
        name: `${profile.first_name} ${profile.last_name}`,
        email: profile.email,
        consultation_fee_cents: d.consultation_fee_cents,
        video_consultation_fee_cents: d.video_consultation_fee_cents,
        base_currency: d.base_currency,
        consultation_types: d.consultation_types || [],
        stripe_ready: !!d.stripe_account_id && !!d.stripe_onboarding_complete,
      };
    }),
  };
}

export async function adminCreateBookingOnBehalf(input: {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  consultation_type: string;
  patient_notes?: string;
  service_id?: string;
}) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const adminSupabase = createAdminClient();

  // Fetch doctor with profile + Stripe info
  const { data: doctor, error: doctorError } = await adminSupabase
    .from("doctors")
    .select(
      `id, slug, stripe_account_id, stripe_onboarding_complete,
       consultation_fee_cents, video_consultation_fee_cents, base_currency,
       cancellation_policy, consultation_types, is_active, verification_status,
       organization_id,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)`
    )
    .eq("id", input.doctor_id)
    .single();

  if (doctorError || !doctor) return { error: "Doctor not found." };

  if (!doctor.is_active || doctor.verification_status !== "verified") {
    return { error: "This doctor is not currently accepting appointments." };
  }
  if (!doctor.stripe_account_id || !doctor.stripe_onboarding_complete) {
    return { error: "This doctor has not completed payment setup." };
  }
  if (!doctor.consultation_types?.includes(input.consultation_type)) {
    return { error: "This doctor does not offer the selected consultation type." };
  }

  // Check org has active license
  let hasActiveLicense = false;
  if (doctor.organization_id) {
    const { data: orgLicense } = await adminSupabase
      .from("licenses")
      .select("id")
      .eq("organization_id", doctor.organization_id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();
    hasActiveLicense = !!orgLicense;
  }
  if (!hasActiveLicense) {
    return { error: "This doctor does not have an active subscription." };
  }

  // Fetch patient
  const { data: patient } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("id", input.patient_id)
    .single();

  if (!patient) return { error: "Patient not found." };

  // Check slot availability — make sure no existing booking occupies this slot
  const { data: existingBooking } = await adminSupabase
    .from("bookings")
    .select("id")
    .eq("doctor_id", input.doctor_id)
    .eq("appointment_date", input.appointment_date)
    .eq("start_time", input.start_time)
    .not("status", "in", "(cancelled_patient,cancelled_doctor,refunded,expired)")
    .limit(1)
    .maybeSingle();

  if (existingBooking) {
    return { error: "This time slot is no longer available." };
  }

  // Calculate fees
  let consultationFeeCents: number;
  let serviceName: string | null = null;

  if (input.service_id) {
    const { data: service } = await adminSupabase
      .from("doctor_services")
      .select("*")
      .eq("id", input.service_id)
      .eq("doctor_id", input.doctor_id)
      .single();

    if (!service || !service.is_active) {
      return { error: "Selected service is no longer available." };
    }
    consultationFeeCents = service.price_cents;
    serviceName = service.name;
  } else {
    consultationFeeCents =
      input.consultation_type === "video" && doctor.video_consultation_fee_cents
        ? doctor.video_consultation_fee_cents
        : doctor.consultation_fee_cents;
  }

  const platformFeeCents = getBookingFeeCents(doctor.base_currency);
  const totalAmountCents = consultationFeeCents + platformFeeCents;

  // Insert booking with pending_payment + admin metadata
  const paymentLinkExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  const { data: booking, error: bookingError } = await adminSupabase
    .from("bookings")
    .insert({
      patient_id: input.patient_id,
      doctor_id: doctor.id,
      appointment_date: input.appointment_date,
      start_time: input.start_time,
      end_time: input.end_time,
      consultation_type: input.consultation_type,
      patient_notes: input.patient_notes || null,
      status: BOOKING_STATUSES.PENDING_PAYMENT,
      currency: doctor.base_currency,
      consultation_fee_cents: consultationFeeCents,
      platform_fee_cents: platformFeeCents,
      total_amount_cents: totalAmountCents,
      service_id: input.service_id || null,
      service_name: serviceName,
      organization_id: doctor.organization_id || null,
      created_by_admin_id: user.id,
      payment_link_expires_at: paymentLinkExpiresAt,
    })
    .select("id, booking_number")
    .single();

  if (bookingError || !booking) {
    console.error("Admin booking insert error:", bookingError);
    return { error: "Failed to create booking. Please try again." };
  }

  // Create Stripe Checkout Session
  const profile: any = Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile;
  const doctorName = `${profile.first_name} ${profile.last_name}`;
  const consultationLabel = serviceName
    ? serviceName
    : input.consultation_type === "video"
      ? "Video Consultation"
      : "In-Person Consultation";

  const { origin, locale } = await getOriginAndLocale();

  // Stripe checkout sessions max out at 24h
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: patient.email,
    line_items: [
      {
        price_data: {
          currency: doctor.base_currency.toLowerCase(),
          product_data: {
            name: `${consultationLabel} with Dr. ${doctorName}`,
            description: `${input.appointment_date} at ${input.start_time}`,
          },
          unit_amount: totalAmountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFeeCents,
      transfer_data: {
        destination: doctor.stripe_account_id,
      },
    },
    metadata: {
      booking_id: booking.id,
      booking_number: booking.booking_number,
    },
    expires_at: expiresAt,
    success_url: `${origin}/${locale}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}`,
  });

  // Store checkout session ID on booking
  await adminSupabase
    .from("bookings")
    .update({ stripe_checkout_session_id: session.id })
    .eq("id", booking.id);

  // Send payment link email
  const { subject, html } = adminBookingPaymentLinkEmail({
    patientName: patient.first_name || "Patient",
    doctorName,
    date: input.appointment_date,
    time: input.start_time,
    consultationType: consultationLabel,
    bookingNumber: booking.booking_number,
    amount: totalAmountCents / 100,
    currency: doctor.base_currency.toUpperCase(),
    paymentUrl: session.url!,
    expiresInHours: 24,
  });

  sendEmail({ to: patient.email, subject, html }).catch((err) =>
    console.error("Admin booking payment link email error:", err)
  );

  await logAdminAction(supabase, user.id, "booking_created_on_behalf", "booking", booking.id, {
    patient_id: input.patient_id,
    patient_email: patient.email,
    doctor_id: input.doctor_id,
    booking_number: booking.booking_number,
  });

  revalidatePath("/admin/bookings");
  return {
    success: true,
    bookingId: booking.id,
    bookingNumber: booking.booking_number,
    patientEmail: patient.email,
  };
}

export async function adminResendPaymentLink(bookingId: string) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const adminSupabase = createAdminClient();

  const { data: booking } = await adminSupabase
    .from("bookings")
    .select(
      `id, booking_number, status, created_by_admin_id,
       stripe_checkout_session_id, payment_link_expires_at,
       appointment_date, start_time, end_time, consultation_type,
       total_amount_cents, consultation_fee_cents, platform_fee_cents,
       currency, service_name,
       patient:profiles!bookings_patient_id_fkey(first_name, last_name, email),
       doctor:doctors!inner(
         stripe_account_id, base_currency,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found." };
  if (booking.status !== BOOKING_STATUSES.PENDING_PAYMENT) {
    return { error: "Booking is not in pending payment status." };
  }
  if (!booking.created_by_admin_id) {
    return { error: "Only admin-created bookings support resend." };
  }

  // Check resend count (stored in audit log)
  const { count } = await adminSupabase
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("target_id", bookingId)
    .eq("action", "payment_link_resent");

  if ((count || 0) >= 5) {
    return { error: "Maximum resend limit (5) reached." };
  }

  // Expire old Stripe checkout session
  if (booking.stripe_checkout_session_id) {
    try {
      await getStripe().checkout.sessions.expire(booking.stripe_checkout_session_id);
    } catch {
      // Session may already be expired
    }
  }

  // Create new Stripe Checkout Session
  const patient: any = Array.isArray(booking.patient) ? booking.patient[0] : booking.patient;
  const doctor: any = booking.doctor;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;

  const doctorName = doctorProfile
    ? `${doctorProfile.first_name} ${doctorProfile.last_name}`
    : "Doctor";

  const consultationLabel = booking.service_name
    ? booking.service_name
    : booking.consultation_type === "video"
      ? "Video Consultation"
      : "In-Person Consultation";

  const { origin, locale } = await getOriginAndLocale();
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer_email: patient.email,
    line_items: [
      {
        price_data: {
          currency: booking.currency.toLowerCase(),
          product_data: {
            name: `${consultationLabel} with Dr. ${doctorName}`,
            description: `${booking.appointment_date} at ${booking.start_time}`,
          },
          unit_amount: booking.total_amount_cents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: booking.platform_fee_cents,
      transfer_data: {
        destination: doctor.stripe_account_id,
      },
    },
    metadata: {
      booking_id: booking.id,
      booking_number: booking.booking_number,
    },
    expires_at: expiresAt,
    success_url: `${origin}/${locale}/booking-confirmation?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${locale}`,
  });

  // Update booking with new session + extended expiry
  const newExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  await adminSupabase
    .from("bookings")
    .update({
      stripe_checkout_session_id: session.id,
      payment_link_expires_at: newExpiry,
    })
    .eq("id", booking.id);

  // Resend email
  const { subject, html } = adminBookingPaymentLinkEmail({
    patientName: patient.first_name || "Patient",
    doctorName,
    date: booking.appointment_date,
    time: booking.start_time,
    consultationType: consultationLabel,
    bookingNumber: booking.booking_number,
    amount: booking.total_amount_cents / 100,
    currency: booking.currency.toUpperCase(),
    paymentUrl: session.url!,
    expiresInHours: 24,
  });

  sendEmail({ to: patient.email, subject, html }).catch((err) =>
    console.error("Resend payment link email error:", err)
  );

  await logAdminAction(supabase, user.id, "payment_link_resent", "booking", bookingId, {
    resend_count: (count || 0) + 1,
    new_session_id: session.id,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  return { success: true, resendCount: (count || 0) + 1 };
}

export async function adminCancelBooking(
  bookingId: string,
  reason?: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

  const adminSupabase = createAdminClient();

  const { data: booking } = await adminSupabase
    .from("bookings")
    .select(
      `*,
       patient:profiles!bookings_patient_id_fkey(
         first_name, last_name, email, phone, notification_whatsapp, preferred_locale
       ),
       doctor:doctors!inner(
         cancellation_policy, cancellation_hours, stripe_account_id,
         profile:profiles!doctors_profile_id_fkey(first_name, last_name)
       )`
    )
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found." };

  // Handle unpaid admin-created bookings
  if (
    booking.status === BOOKING_STATUSES.PENDING_PAYMENT &&
    booking.created_by_admin_id
  ) {
    // Expire Stripe session
    if (booking.stripe_checkout_session_id) {
      try {
        await getStripe().checkout.sessions.expire(booking.stripe_checkout_session_id);
      } catch {
        // May already be expired
      }
    }

    // Delete the booking to release the slot
    await adminSupabase.from("bookings").delete().eq("id", bookingId);

    await logAdminAction(supabase, user.id, "admin_booking_cancelled_unpaid", "booking", bookingId, {
      booking_number: booking.booking_number,
      reason,
    });

    revalidatePath("/admin/bookings");
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { success: true, message: "Unpaid booking deleted and slot released." };
  }

  // For paid bookings (confirmed/approved)
  const CANCELLABLE = [
    BOOKING_STATUSES.CONFIRMED,
    BOOKING_STATUSES.PENDING_APPROVAL,
    BOOKING_STATUSES.APPROVED,
  ];
  if (!CANCELLABLE.includes(booking.status)) {
    return { error: `Cannot cancel a booking with status "${booking.status}".` };
  }

  // Calculate refund based on cancellation policy
  const appointmentDateTime = new Date(
    `${booking.appointment_date}T${booking.start_time}`
  );
  const now = new Date();
  const hoursUntilAppointment =
    (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  let refundPercent = 0;
  const doctor: any = booking.doctor;
  const policy = doctor.cancellation_policy;

  if (policy === "flexible") {
    refundPercent = hoursUntilAppointment > 24 ? 100 : 0;
  } else if (policy === "moderate") {
    if (hoursUntilAppointment > 48) {
      refundPercent = 100;
    } else if (hoursUntilAppointment > 24) {
      refundPercent = 50;
    } else {
      refundPercent = 0;
    }
  } else if (policy === "strict") {
    refundPercent = hoursUntilAppointment > 72 ? 100 : 0;
  }

  // Process Stripe refund
  let refundAmountCents = 0;
  if (
    booking.stripe_payment_intent_id &&
    refundPercent > 0 &&
    booking.total_amount_cents > 0
  ) {
    refundAmountCents = Math.round(
      (booking.total_amount_cents * refundPercent) / 100
    );

    try {
      await getStripe().refunds.create({
        payment_intent: booking.stripe_payment_intent_id,
        amount: refundAmountCents,
        reverse_transfer: true,
        refund_application_fee: true,
      } as any);
    } catch (err: any) {
      console.error("Admin cancel refund error:", err);
      return { error: safeError(err) };
    }
  }

  // Update booking status
  const updateData: Record<string, unknown> = {
    status: BOOKING_STATUSES.CANCELLED_DOCTOR,
    cancelled_at: new Date().toISOString(),
    cancellation_reason: reason || "Cancelled by admin",
  };
  if (refundAmountCents > 0) {
    updateData.refund_amount_cents = refundAmountCents;
    updateData.refunded_at = new Date().toISOString();
  }

  await adminSupabase
    .from("bookings")
    .update(updateData)
    .eq("id", bookingId);

  // Remove from calendars (non-blocking)
  removeBookingFromGoogleCalendar(bookingId).catch((err) =>
    console.error("Google Calendar removal error:", err)
  );
  removeBookingFromMicrosoftCalendar(bookingId).catch((err) =>
    console.error("Microsoft Calendar removal error:", err)
  );
  removeBookingFromCalDAV(bookingId).catch((err) =>
    console.error("CalDAV removal error:", err)
  );

  // Delete Daily.co video room
  if (booking.daily_room_name) {
    deleteRoom(booking.daily_room_name).catch((err) =>
      console.error("Daily.co room deletion error:", err)
    );
  }

  // Send cancellation email
  const patient: any = Array.isArray(booking.patient)
    ? booking.patient[0]
    : booking.patient;
  const doctorProfile: any = doctor?.profile
    ? (Array.isArray(doctor.profile) ? doctor.profile[0] : doctor.profile)
    : null;

  if (patient?.email && doctorProfile) {
    const refundAmount = refundAmountCents / 100;
    const { subject, html } = bookingCancellationEmail({
      patientName: patient.first_name || "Patient",
      doctorName: `${doctorProfile.first_name} ${doctorProfile.last_name}`,
      date: booking.appointment_date,
      time: booking.start_time,
      bookingNumber: booking.booking_number,
      refundAmount,
      currency: booking.currency.toUpperCase(),
    });

    sendEmail({ to: patient.email, subject, html }).catch((err) =>
      console.error("Admin cancellation email error:", err)
    );

    // WhatsApp notification
    if (patient.notification_whatsapp && patient.phone) {
      const refundInfo =
        refundPercent > 0
          ? `A ${refundPercent}% refund has been initiated.`
          : "No refund applicable per cancellation policy.";

      sendWhatsAppTemplate({
        to: patient.phone,
        templateName: TEMPLATE_BOOKING_CANCELLATION,
        languageCode: mapLocaleToWhatsApp(patient.preferred_locale),
        components: buildBookingCancellationComponents({
          patientName: patient.first_name || "there",
          bookingNumber: booking.booking_number,
          date: booking.appointment_date,
          refundInfo,
        }),
      }).catch((err) =>
        console.error("WhatsApp cancellation error:", err)
      );
    }
  }

  await logAdminAction(supabase, user.id, "booking_cancelled_by_admin", "booking", bookingId, {
    booking_number: booking.booking_number,
    policy,
    refund_percent: refundPercent,
    refund_amount_cents: refundAmountCents,
    reason,
  });

  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/bookings");
  return {
    success: true,
    refundPercent,
    refundAmountCents,
    message:
      refundPercent > 0
        ? `Booking cancelled. A ${refundPercent}% refund (${booking.currency.toUpperCase()} ${(refundAmountCents / 100).toFixed(2)}) has been processed.`
        : "Booking cancelled. No refund applicable based on the cancellation policy.",
  };
}

/** Preview the refund amount for a booking before cancelling */
export async function adminGetCancelPreview(bookingId: string) {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError };

  const adminSupabase = createAdminClient();

  const { data: booking } = await adminSupabase
    .from("bookings")
    .select(
      `id, status, appointment_date, start_time, total_amount_cents, currency,
       created_by_admin_id, stripe_checkout_session_id,
       doctor:doctors!inner(cancellation_policy, cancellation_hours)`
    )
    .eq("id", bookingId)
    .single();

  if (!booking) return { error: "Booking not found." };

  // Unpaid admin booking
  if (
    booking.status === BOOKING_STATUSES.PENDING_PAYMENT &&
    booking.created_by_admin_id
  ) {
    return {
      isUnpaid: true,
      refundPercent: 0,
      refundAmountCents: 0,
      policy: null,
      message: "This is an unpaid admin booking. Cancelling will delete it and release the slot.",
    };
  }

  const doctor: any = booking.doctor;
  const policy = doctor.cancellation_policy;

  const appointmentDateTime = new Date(
    `${booking.appointment_date}T${booking.start_time}`
  );
  const now = new Date();
  const hoursUntilAppointment =
    (appointmentDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);

  let refundPercent = 0;
  if (policy === "flexible") {
    refundPercent = hoursUntilAppointment > 24 ? 100 : 0;
  } else if (policy === "moderate") {
    if (hoursUntilAppointment > 48) {
      refundPercent = 100;
    } else if (hoursUntilAppointment > 24) {
      refundPercent = 50;
    }
  } else if (policy === "strict") {
    refundPercent = hoursUntilAppointment > 72 ? 100 : 0;
  }

  const refundAmountCents = Math.round(
    (booking.total_amount_cents * refundPercent) / 100
  );

  return {
    isUnpaid: false,
    refundPercent,
    refundAmountCents,
    totalAmountCents: booking.total_amount_cents,
    currency: booking.currency,
    policy,
    hoursUntilAppointment: Math.round(hoursUntilAppointment * 10) / 10,
    message:
      refundPercent > 0
        ? `Based on the ${policy} policy, the patient will receive a ${refundPercent}% refund (${booking.currency.toUpperCase()} ${(refundAmountCents / 100).toFixed(2)}).`
        : `Based on the ${policy} policy, no refund is applicable.`,
  };
}

// ===================== CSV Export Actions =====================

export async function exportRevenueCSV() {
  const { error: authError, supabase } = await requireAdmin();
  if (authError || !supabase) return { error: authError, headers: [], rows: [] };

  const { data: fees } = await supabase
    .from("platform_fees")
    .select(
      `amount_cents, currency, fee_type, created_at,
       booking:bookings(booking_number),
       doctor:doctors(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const headers = ["Date", "Booking #", "Doctor", "Fee Type", "Amount", "Currency"];
  const rows = (fees || []).map((f: any) => [
    new Date(f.created_at).toISOString().split("T")[0],
    f.booking?.booking_number || "",
    `${f.doctor?.profile?.first_name || ""} ${f.doctor?.profile?.last_name || ""}`.trim(),
    f.fee_type,
    (f.amount_cents / 100).toFixed(2),
    f.currency,
  ]);

  return { headers, rows };
}
