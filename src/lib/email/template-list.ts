// Shared template metadata — importable from both server actions and client components

export type TemplateKey =
  | "bookingConfirmation"
  | "bookingCancellation"
  | "bookingReminder"
  | "rescheduleRequest"
  | "rescheduleResponse"
  | "adminBookingPaymentLink"
  | "welcome"
  | "doctorVerified"
  | "doctorRejected"
  | "reviewReceived"
  | "newMessage"
  | "adminMessage"
  | "treatmentPlan"
  | "followUpInvitation"
  | "treatmentContinuation"
  | "invoice"
  | "supportTicketCreated"
  | "supportTicketReply"
  | "supportTicketResolved"
  | "contactInquiryAdmin"
  | "contactInquiryAutoReply"
  | "doctorReferralInvitation"
  | "referralReward"
  | "subscriptionUpgradeInvite"
  | "availabilityAlert"
  | "satisfactionSurvey";

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
  // Care plans
  { key: "treatmentPlan", label: "Care Plan", category: "Care Plans" },
  { key: "followUpInvitation", label: "Follow-Up Invitation", category: "Care Plans" },
  { key: "treatmentContinuation", label: "Care Plan Reminder", category: "Care Plans" },
  { key: "invoice", label: "Invoice", category: "Care Plans" },
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
  // Notifications
  { key: "availabilityAlert", label: "Availability Alert", category: "Notifications" },
  { key: "satisfactionSurvey", label: "Satisfaction Survey (NPS)", category: "Notifications" },
];
