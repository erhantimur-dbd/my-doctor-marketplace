"use server";

import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";
import * as templates from "@/lib/email/templates";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

// Sample data for each template
const SAMPLE_DATA = {
  bookingConfirmation: () =>
    templates.bookingConfirmationEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      date: "2026-04-01",
      time: "10:00",
      consultationType: "Video Consultation",
      bookingNumber: "BK-TEST-001",
      amount: 120,
      currency: "GBP",
      videoRoomUrl: `${APP_URL}/room/test-room`,
    }),
  bookingCancellation: () =>
    templates.bookingCancellationEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      date: "2026-04-01",
      time: "10:00",
      bookingNumber: "BK-TEST-001",
      refundAmount: 120,
      currency: "GBP",
    }),
  bookingReminder: () =>
    templates.bookingReminderEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      date: "2026-04-01",
      time: "10:00",
      consultationType: "Video Consultation",
      bookingNumber: "BK-TEST-001",
      videoRoomUrl: `${APP_URL}/room/test-room`,
    }),
  welcome: () =>
    templates.welcomeEmail({ name: "John" }),
  doctorVerified: () =>
    templates.doctorVerifiedEmail({
      doctorName: "Sarah Williams",
    }),
  doctorRejected: () =>
    templates.doctorRejectedEmail({
      doctorName: "Sarah Williams",
    }),
  reviewReceived: () =>
    templates.reviewReceivedEmail({
      doctorName: "Sarah Williams",
      patientName: "John Doe",
      rating: 5,
    }),
  doctorReferralInvitation: () =>
    templates.doctorReferralInvitationEmail({
      referrerName: "Dr. Sarah Williams",
      colleagueName: "Dr. James",
      referralCode: "REF-TEST-123",
      signUpUrl: `${APP_URL}/en/register-doctor?ref=REF-TEST-123`,
    }),
  referralReward: () =>
    templates.referralRewardEmail({
      doctorName: "Sarah Williams",
      referredDoctorName: "Dr. James Anderson",
    }),
  supportTicketCreated: () =>
    templates.supportTicketCreatedEmail({
      userName: "John",
      ticketNumber: "TK-TEST-001",
      category: "technical",
      ticketSubject: "Unable to join video consultation",
      dashboardUrl: `${APP_URL}/en/dashboard/support`,
    }),
  supportTicketReply: () =>
    templates.supportTicketReplyEmail({
      userName: "John",
      ticketNumber: "TK-TEST-001",
      replyPreview: "We've looked into this and found the issue. Please try clearing your browser cache and rejoining...",
      dashboardUrl: `${APP_URL}/en/dashboard/support`,
    }),
  supportTicketResolved: () =>
    templates.supportTicketResolvedEmail({
      userName: "John",
      ticketNumber: "TK-TEST-001",
      ticketSubject: "Unable to join video consultation",
      dashboardUrl: `${APP_URL}/en/dashboard/support`,
    }),
  contactInquiryAdmin: () =>
    templates.contactInquiryAdminEmail({
      name: "Jane Smith",
      email: "jane@example.com",
      inquiryType: "partnership",
      message: "Hi, I run a private clinic in London and I'm interested in listing our doctors on your platform...",
    }),
  contactInquiryAutoReply: () =>
    templates.contactInquiryAutoReplyEmail({
      name: "Jane",
      inquiryType: "partnership",
    }),
  adminMessage: () =>
    templates.adminMessageEmail({
      recipientName: "John",
      subject: "Platform Update",
      message: "We're excited to announce that we've added 15 new specialists this month, including paediatric and dermatology experts.",
    }),
  subscriptionUpgradeInvite: () =>
    templates.subscriptionUpgradeInviteEmail({
      doctorName: "Sarah Williams",
      subscriptionUrl: `${APP_URL}/en/doctor-dashboard/organization/billing`,
    }),
  treatmentPlan: () =>
    templates.treatmentPlanEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      planTitle: "Post-Consultation Care Plan",
      description: "Follow-up care for seasonal allergies including prescribed antihistamines and lifestyle recommendations.",
      totalSessions: 4,
      unitPrice: "£60.00",
      discount: "10%",
      totalPrice: "£216.00",
      paymentType: "per_session",
      doctorNote: "Please bring your previous allergy test results to the first session.",
      planUrl: `${APP_URL}/en/dashboard/treatment-plans/test`,
      expiresAt: "2026-04-15",
    }),
  followUpInvitation: () =>
    templates.followUpInvitationEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      serviceName: "Follow-Up Consultation",
      totalSessions: 1,
      unitPrice: "£60.00",
      discount: null,
      totalPrice: "£60.00",
      doctorNote: "It's been 4 weeks since your initial consultation. I'd like to check on your progress.",
      invitationUrl: `${APP_URL}/en/doctors/dr-sarah-williams`,
      expiresAt: "2026-04-15",
    }),
  newMessage: () =>
    templates.newMessageEmail({
      recipientName: "John",
      senderName: "Dr. Sarah Williams",
      messagesUrl: `${APP_URL}/en/dashboard/messages`,
    }),
  invoice: () =>
    templates.invoiceEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      invoiceNumber: "INV-TEST-001",
      items: "Follow-up video consultation — dermatology",
      totalAmount: "£85.00",
      dueDate: "2026-04-15",
      invoiceUrl: `${APP_URL}/en/dashboard/invoices/test`,
      doctorNote: null,
    }),
  treatmentContinuation: () =>
    templates.treatmentContinuationEmail({
      patientName: "John",
      doctorName: "Dr. Sarah Williams",
      invoiceNumber: "INV-TEST-002",
      services: "Allergy Management Program — Session 2",
      totalAmount: "£60.00",
      dueDate: "2026-04-20",
      invoiceUrl: `${APP_URL}/en/dashboard/invoices/test-2`,
      reminderNumber: 1,
    }),
  adminBookingPaymentLink: () =>
    templates.adminBookingPaymentLinkEmail({
      patientName: "John",
      doctorName: "Sarah Williams",
      date: "2026-04-15",
      time: "14:30",
      consultationType: "In-Person",
      bookingNumber: "BK-TEST-002",
      amount: 200,
      currency: "GBP",
      paymentUrl: `${APP_URL}/pay/test-session`,
      expiresInHours: 24,
    }),
  rescheduleRequest: () =>
    templates.rescheduleRequestEmail({
      doctorName: "Sarah Williams",
      patientName: "John Doe",
      originalDate: "2026-04-01",
      originalTime: "10:00",
      newDate: "2026-04-03",
      newTime: "14:00",
      dashboardUrl: `${APP_URL}/en/doctor-dashboard/bookings`,
    }),
  rescheduleResponse: () =>
    templates.rescheduleResponseEmail({
      patientName: "John",
      doctorName: "Sarah Williams",
      approved: true,
      newDate: "2026-04-03",
      newTime: "14:00",
      originalDate: "2026-04-01",
      originalTime: "10:00",
      dashboardUrl: `${APP_URL}/en/dashboard/bookings`,
    }),
};

export type TemplateKey = keyof typeof SAMPLE_DATA;

export const TEMPLATE_LIST: { key: TemplateKey; label: string; category: string }[] = [
  // Booking
  { key: "bookingConfirmation", label: "Booking Confirmation", category: "Booking" },
  { key: "bookingCancellation", label: "Booking Cancellation", category: "Booking" },
  { key: "bookingReminder", label: "Booking Reminder", category: "Booking" },
  { key: "rescheduleRequest", label: "Reschedule Request (→ Doctor)", category: "Booking" },
  { key: "rescheduleResponse", label: "Reschedule Approved (→ Patient)", category: "Booking" },
  { key: "adminBookingPaymentLink", label: "Admin Payment Link", category: "Booking" },
  // Onboarding
  { key: "welcome", label: "Welcome Email", category: "Onboarding" },
  { key: "doctorVerified", label: "Doctor Verified", category: "Onboarding" },
  { key: "doctorRejected", label: "Doctor Rejected", category: "Onboarding" },
  // Reviews & Messages
  { key: "reviewReceived", label: "Review Received (→ Doctor)", category: "Engagement" },
  { key: "newMessage", label: "New Message", category: "Engagement" },
  { key: "adminMessage", label: "Admin Broadcast", category: "Engagement" },
  // Treatment
  { key: "treatmentPlan", label: "Treatment Plan", category: "Treatment" },
  { key: "followUpInvitation", label: "Follow-Up Invitation", category: "Treatment" },
  { key: "treatmentContinuation", label: "Treatment Continuation", category: "Treatment" },
  { key: "invoice", label: "Invoice", category: "Treatment" },
  // Support
  { key: "supportTicketCreated", label: "Ticket Created", category: "Support" },
  { key: "supportTicketReply", label: "Ticket Reply", category: "Support" },
  { key: "supportTicketResolved", label: "Ticket Resolved", category: "Support" },
  // Contact
  { key: "contactInquiryAdmin", label: "Contact → Admin", category: "Contact" },
  { key: "contactInquiryAutoReply", label: "Contact Auto-Reply", category: "Contact" },
  // Referrals
  { key: "doctorReferralInvitation", label: "Referral Invitation", category: "Referral" },
  { key: "referralReward", label: "Referral Reward", category: "Referral" },
  // Subscription
  { key: "subscriptionUpgradeInvite", label: "Upgrade Invite", category: "Subscription" },
];

export async function sendTestEmail(templateKey: TemplateKey, toEmail: string) {
  // Auth check — admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
    return { error: "Admin access required" };
  }

  const generator = SAMPLE_DATA[templateKey];
  if (!generator) return { error: `Unknown template: ${templateKey}` };

  const { subject, html } = generator();

  const result = await sendEmail({
    to: toEmail,
    subject: `[TEST] ${subject}`,
    html,
  });

  return result;
}

export async function sendAllTestEmails(toEmail: string) {
  // Auth check — admin only
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", results: [] };

  const adminEmails = (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());
  if (!adminEmails.includes(user.email?.toLowerCase() || "")) {
    return { error: "Admin access required", results: [] };
  }

  const results: { key: string; success: boolean; error?: string }[] = [];

  for (const { key } of TEMPLATE_LIST) {
    const generator = SAMPLE_DATA[key];
    const { subject, html } = generator();

    try {
      const result = await sendEmail({
        to: toEmail,
        subject: `[TEST] ${subject}`,
        html,
      });
      results.push({ key, success: result.success });
    } catch (err: any) {
      results.push({ key, success: false, error: err.message });
    }

    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }

  return { results };
}
