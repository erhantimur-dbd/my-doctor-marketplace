/**
 * Optional account claim on the guest confirmation screen.
 * Linking is idempotent and only includes guest bookings whose patient
 * email matches the verified account email.
 */

import { emailsMatch, normalizeLookupEmail } from "@/lib/booking/find-booking";

export const GUEST_SIGNUP_CARD_TITLE =
  "Create an account to manage your booking";

export const EXISTING_ACCOUNT_MESSAGE = "Log in to see this booking";

export type GuestAuthKind = "claimable_guest" | "existing_account" | "missing";

export type GuestBookingCandidate = {
  id: string;
  isGuest: boolean;
  patientId: string;
  patientEmail: string | null;
};

export function shouldShowGuestSignupCard(input: {
  isGuest: boolean;
  loggedIn: boolean;
}): boolean {
  return input.isGuest === true && input.loggedIn === false;
}

export function guestConfirmationPrompt(input: {
  isGuest: boolean;
  loggedIn: boolean;
  accountKind: GuestAuthKind;
}): "hidden" | "create" | "login" {
  if (!shouldShowGuestSignupCard(input)) return "hidden";
  if (input.accountKind === "existing_account") return "login";
  return "create";
}

export function classifyGuestAuthUser(input: {
  bookingPatientId: string;
  authUserId: string | null;
  createdVia: string | null;
  passwordSetAt: string | null;
}): GuestAuthKind {
  if (!input.authUserId) return "missing";
  if (input.authUserId !== input.bookingPatientId) return "existing_account";
  if (input.passwordSetAt) return "existing_account";
  if (input.createdVia !== "guest_checkout") return "existing_account";
  return "claimable_guest";
}

export function confirmedEmailMatches(input: {
  emailConfirmed: boolean;
  authEmail: string | null;
  bookingEmail: string | null;
}): boolean {
  if (!input.emailConfirmed) return false;
  return emailsMatch(input.authEmail, input.bookingEmail);
}

/**
 * Booking ids to attach to the verified account.
 * Same input returns the same ids. Bookings for any other email are omitted.
 */
export function selectGuestBookingsToAttach(input: {
  verifiedEmail: string;
  emailConfirmed: boolean;
  bookings: GuestBookingCandidate[];
}): string[] {
  if (!input.emailConfirmed) return [];
  const email = normalizeLookupEmail(input.verifiedEmail);
  if (!email.includes("@")) return [];
  return input.bookings
    .filter(
      (booking) =>
        booking.isGuest && emailsMatch(booking.patientEmail, email)
    )
    .map((booking) => booking.id);
}

export type GuestSignupPlan =
  | { action: "hidden" }
  | { action: "login" }
  | { action: "reject"; error: string }
  | { action: "claim"; bookingIds: string[] };

export function planGuestSignup(input: {
  isGuestBooking: boolean;
  loggedIn: boolean;
  submittedEmail: string;
  bookingEmail: string | null;
  emailConfirmed: boolean;
  authEmail: string | null;
  accountKind: GuestAuthKind;
  bookings: GuestBookingCandidate[];
}): GuestSignupPlan {
  const prompt = guestConfirmationPrompt({
    isGuest: input.isGuestBooking,
    loggedIn: input.loggedIn,
    accountKind: input.accountKind,
  });
  if (prompt === "hidden") return { action: "hidden" };
  if (prompt === "login" || input.accountKind === "existing_account") {
    return { action: "login" };
  }
  if (!emailsMatch(input.submittedEmail, input.bookingEmail)) {
    return {
      action: "reject",
      error: "Use the email address on this booking.",
    };
  }
  if (
    !confirmedEmailMatches({
      emailConfirmed: input.emailConfirmed,
      authEmail: input.authEmail,
      bookingEmail: input.bookingEmail,
    })
  ) {
    return {
      action: "reject",
      error: "Confirm this email before creating an account.",
    };
  }
  if (input.accountKind !== "claimable_guest") {
    return { action: "login" };
  }
  return {
    action: "claim",
    bookingIds: selectGuestBookingsToAttach({
      verifiedEmail: input.authEmail || input.bookingEmail || "",
      emailConfirmed: true,
      bookings: input.bookings,
    }),
  };
}
