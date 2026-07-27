import { getGpOfferByToken, patientAcceptGpOffer, patientDeclineGpOffers } from "@/actions/gp-reassignment";
import { GpOfferClient } from "./gp-offer-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Choose a GP slot",
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string; locale: string }>;
  searchParams: Promise<{ action?: string }>;
}

export default async function GpOfferPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  const { offer, error } = await getGpOfferByToken(token);

  if (error || !offer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">Offer not found</h1>
        <p className="mt-2 text-muted-foreground">
          This link is invalid or has already been used.
        </p>
      </div>
    );
  }

  const doctorRaw = offer.doctor as
    | {
        slug?: string;
        profile?:
          | { first_name?: string; last_name?: string }
          | { first_name?: string; last_name?: string }[];
      }
    | {
        slug?: string;
        profile?:
          | { first_name?: string; last_name?: string }
          | { first_name?: string; last_name?: string }[];
      }[]
    | null;
  const doctor = Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw;
  const profileRaw = doctor?.profile;
  const profile = Array.isArray(profileRaw) ? profileRaw[0] : profileRaw;
  const doctorName = profile
    ? `Dr. ${profile.first_name || ""} ${profile.last_name || ""}`.trim()
    : "GP";

  const bookingRaw = offer.booking as
    | {
        id: string;
        booking_number: string;
        currency: string;
        gp_reassignment_status: string | null;
      }
    | {
        id: string;
        booking_number: string;
        currency: string;
        gp_reassignment_status: string | null;
      }[]
    | null;
  const booking = Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw;

  return (
    <GpOfferClient
      token={token}
      doctorName={doctorName}
      appointmentDate={offer.appointment_date}
      startTime={String(offer.start_time).slice(0, 5)}
      consultationType={offer.consultation_type}
      feeCents={offer.fee_cents}
      currency={booking?.currency || "GBP"}
      bookingNumber={booking?.booking_number || ""}
      status={offer.status}
      expiresAt={offer.expires_at}
      initialAction={sp.action === "decline_all" ? "decline_all" : undefined}
    />
  );
}
