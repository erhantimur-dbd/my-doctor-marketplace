/**
 * Authorise a booking .ics download the same way the confirmation page loads
 * the booking: Stripe session, guest confirm=1, or a signed-in owner.
 */

import {
  resolveConfirmationLookup,
  type ConfirmationQuery,
} from "@/lib/booking/confirmation-params";

export type CalendarDownloadAccess =
  | { ok: true; adminFallback: boolean; requireOwner: boolean }
  | { ok: false; status: 401 | 403 | 404 };

function nonEmpty(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function calendarDownloadPath(
  bookingId: string,
  query: ConfirmationQuery
): string {
  const params = new URLSearchParams();
  if (nonEmpty(query.session_id)) params.set("session_id", query.session_id!.trim());
  if (nonEmpty(query.booking_id)) params.set("booking_id", query.booking_id!.trim());
  if (nonEmpty(query.confirm)) params.set("confirm", query.confirm!.trim());
  if (nonEmpty(query.wallet)) params.set("wallet", query.wallet!.trim());
  const qs = params.toString();
  return `/api/bookings/${encodeURIComponent(bookingId)}/calendar.ics${qs ? `?${qs}` : ""}`;
}

/**
 * Mirror `booking-confirmation/page.tsx` lookup rules for the .ics route.
 * `stripeBookingId` is the Checkout session metadata booking id when the
 * query is a Stripe return. Guests with confirm=1 may download. A bare
 * booking id requires the signed-in patient who owns it.
 */
export function evaluateCalendarDownloadAccess(input: {
  pathBookingId: string;
  query: ConfirmationQuery;
  userId: string | null;
  stripeBookingId?: string | null;
  stripeError?: boolean;
}): CalendarDownloadAccess {
  const pathId = input.pathBookingId.trim();
  if (!pathId) return { ok: false, status: 404 };

  const queryBookingId = nonEmpty(input.query.booking_id);
  if (queryBookingId && queryBookingId !== pathId) {
    return { ok: false, status: 403 };
  }

  const lookup = resolveConfirmationLookup({
    session_id: input.query.session_id,
    booking_id: queryBookingId ?? pathId,
    wallet: input.query.wallet,
    confirm: input.query.confirm,
  });

  if (lookup.mode === "invalid") return { ok: false, status: 404 };

  if (lookup.mode === "stripe_session") {
    if (input.stripeError || !input.stripeBookingId) {
      return { ok: false, status: 404 };
    }
    if (input.stripeBookingId !== pathId) return { ok: false, status: 403 };
    return { ok: true, adminFallback: true, requireOwner: false };
  }

  if (lookup.mode === "direct_confirm") {
    if (lookup.bookingId !== pathId) return { ok: false, status: 403 };
    return { ok: true, adminFallback: true, requireOwner: false };
  }

  if (!input.userId) return { ok: false, status: 401 };
  if (lookup.bookingId !== pathId) return { ok: false, status: 403 };
  return { ok: true, adminFallback: false, requireOwner: true };
}
