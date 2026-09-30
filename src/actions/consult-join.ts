"use server";

import { issueConsultJoin, JOIN_MESSAGES } from "@/lib/video/consult-join";
import { parseGuestLinkExp } from "@/lib/video/guest-join-link";
import {
  isConsultJoinSource,
  type ConsultJoinSource,
} from "@/lib/video/join-source";
import { loadConsultJoinAttempt } from "@/lib/video/load-consult-join";

const BOOKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function mintConsultJoin(input: {
  bookingId: string;
  source: ConsultJoinSource;
  guestSignature?: string | null;
  exp?: number | string | null;
}): Promise<{ ok: true; joinUrl: string } | { ok: false; error: string }> {
  if (!input || !isConsultJoinSource(input.source) || !BOOKING_ID.test(input.bookingId || "")) {
    return { ok: false, error: JOIN_MESSAGES.unauthorised };
  }

  const loaded = await loadConsultJoinAttempt({
    bookingId: input.bookingId,
    guestSignature: input.guestSignature?.trim() || null,
    guestLinkExp: parseGuestLinkExp(input.exp),
  });
  if (!loaded) return { ok: false, error: JOIN_MESSAGES.unauthorised };

  const issued = await issueConsultJoin({
    source: input.source,
    booking: loaded.booking,
    caller: loaded.caller,
  });
  if (!issued.ok) return issued;
  return { ok: true, joinUrl: issued.joinUrl };
}
