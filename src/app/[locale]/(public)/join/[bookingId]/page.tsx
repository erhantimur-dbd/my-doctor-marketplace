import { JoinConsultButton } from "@/components/booking/join-consult-button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  assessConsultJoin,
  callerIsAssignedDoctor,
  JOIN_MESSAGES,
} from "@/lib/video/consult-join";
import { verifyGuestConsultJoin } from "@/lib/video/guest-join-link";
import { loadConsultJoinAttempt } from "@/lib/video/load-consult-join";
import {
  sourceAllowsGuestSignature,
  type ConsultJoinSource,
} from "@/lib/video/join-source";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join video appointment",
  robots: { index: false, follow: false },
};

interface ConsultJoinPageProps {
  params: Promise<{ locale: string; bookingId: string }>;
  searchParams: Promise<{ sig?: string; src?: string }>;
}

function joinSource(input: {
  src: string | undefined;
  signedOutGuest: boolean;
}): ConsultJoinSource {
  if (input.src === "confirm") return "booking_confirmation";
  if (input.src === "guest" || input.signedOutGuest) return "guest_join";
  return "email_join_page";
}

export default async function ConsultJoinPage({
  params,
  searchParams,
}: ConsultJoinPageProps) {
  const { bookingId } = await params;
  const sp = await searchParams;
  const signature = sp.sig?.trim() || null;

  const loaded = await loadConsultJoinAttempt({
    bookingId,
    guestSignature: signature,
  }).catch(() => null);

  if (!loaded) {
    return <JoinNotice message={JOIN_MESSAGES.unauthorised} />;
  }

  const signedOutGuest = !loaded.caller.userId && Boolean(signature);
  const source = joinSource({ src: sp.src, signedOutGuest });
  const mayView =
    callerIsAssignedDoctor(loaded.booking, loaded.caller) ||
    loaded.caller.userId === loaded.booking.patientId ||
    (sourceAllowsGuestSignature(source) &&
      verifyGuestConsultJoin(
        loaded.booking.id,
        loaded.booking.bookingNumber,
        loaded.caller.guestSignature
      ));
  if (!mayView) {
    return <JoinNotice message={JOIN_MESSAGES.unauthorised} />;
  }

  const decision = assessConsultJoin({
    source,
    booking: loaded.booking,
    caller: loaded.caller,
  });

  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Join video appointment</h1>
          <p className="text-sm text-muted-foreground">
            Booking {loaded.booking.bookingNumber}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {decision.ok ? (
            <>
              <p className="text-sm text-muted-foreground">
                {decision.role === "doctor"
                  ? "You are joining as the doctor."
                  : "You are joining as the patient."}
              </p>
              <JoinConsultButton
                bookingId={loaded.booking.id}
                source={source}
                guestSignature={signature}
                label="Join video call"
                size="lg"
                className="w-full"
              />
            </>
          ) : (
            <p className="text-sm" role="alert">
              {decision.error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function JoinNotice({ message }: { message: string }) {
  return (
    <div className="container mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-bold">Join video appointment</h1>
        </CardHeader>
        <CardContent>
          <p className="text-sm" role="alert">
            {message}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
