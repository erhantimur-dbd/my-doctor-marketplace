"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { subscriptionUpgradeInviteEmail } from "@/lib/email/templates";
import { createNotification } from "@/lib/notifications";

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

export async function updateDoctorVerification(
  doctorId: string,
  status: string
) {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !supabase || !user) return { error: authError };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

  await logAdminAction(supabase, user.id, "setting_updated", "platform_setting", key, { value });

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

  // Check they don't already have an active subscription
  const { data: activeSub } = await supabase
    .from("doctor_subscriptions")
    .select("id, plan_id")
    .eq("doctor_id", doctorId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (activeSub) return { error: "Doctor already has an active subscription" };

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

  if (resetError) return { error: resetError.message };

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
    return { error: `Stripe error: ${err.message}` };
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

  if (insertError) return { error: insertError.message };

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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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
    return { error: `Stripe refund error: ${err.message}` };
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      refund_amount_cents: refundAmount,
    })
    .eq("id", bookingId);

  if (updateError) return { error: updateError.message };

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

  if (updateError) return { error: updateError.message };

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
    if (banError) return { error: banError.message };
  } catch (err: any) {
    return { error: `Failed to update user: ${err.message}` };
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

  if (error) return { error: error.message };

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

  if (error) return { error: error.message };

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
    return { error: `Failed to send email: ${err.message}` };
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
