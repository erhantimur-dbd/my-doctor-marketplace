"use client";

import { useState, useTransition, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils/currency";
import {
  patientAcceptGpOffer,
  patientDeclineGpOffers,
} from "@/actions/gp-reassignment";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

interface Props {
  token: string;
  doctorName: string;
  appointmentDate: string;
  startTime: string;
  consultationType: string;
  feeCents: number;
  currency: string;
  bookingNumber: string;
  status: string;
  expiresAt: string;
  initialAction?: "decline_all";
}

export function GpOfferClient({
  token,
  doctorName,
  appointmentDate,
  startTime,
  consultationType,
  feeCents,
  currency,
  bookingNumber,
  status: initialStatus,
  expiresAt,
  initialAction,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<"accepted" | "declined" | "error" | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialAction === "decline_all" && initialStatus === "pending") {
      startTransition(async () => {
        const res = await patientDeclineGpOffers(token);
        if (res.error) {
          setError(res.error);
          setResult("error");
        } else {
          setResult("declined");
        }
      });
    }
  }, [initialAction, initialStatus, token]);

  const expired = new Date(expiresAt).getTime() < Date.now();
  const inactive = initialStatus !== "pending" || expired || result;

  function accept() {
    startTransition(async () => {
      const res = await patientAcceptGpOffer(token);
      if (res.error) {
        setError(res.error);
        setResult("error");
      } else {
        setResult("accepted");
        if (res.bookingId) {
          setTimeout(() => {
            router.push(`/dashboard/bookings/${res.bookingId}`);
          }, 1500);
        }
      }
    });
  }

  function decline() {
    startTransition(async () => {
      const res = await patientDeclineGpOffers(token);
      if (res.error) {
        setError(res.error);
        setResult("error");
      } else {
        setResult("declined");
      }
    });
  }

  if (result === "accepted") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
        <h1 className="mt-4 text-2xl font-bold">Appointment updated</h1>
        <p className="mt-2 text-muted-foreground">
          Your GP appointment is confirmed with {doctorName}.
        </p>
      </div>
    );
  }

  if (result === "declined") {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <XCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-bold">Full refund issued</h1>
        <p className="mt-2 text-muted-foreground">
          We have cancelled booking {bookingNumber} and initiated a full refund.
        </p>
        <Button className="mt-6" onClick={() => router.push("/doctors?specialty=general-practice")}>
          Find another GP
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle>New GP appointment option</CardTitle>
          <p className="text-sm text-muted-foreground">
            Booking {bookingNumber}. Your original GP could not attend — please
            accept this slot or decline for a full refund.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">GP:</span>{" "}
              <strong>{doctorName}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">Date:</span>{" "}
              {new Date(appointmentDate).toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p>
              <span className="text-muted-foreground">Time:</span> {startTime}
            </p>
            <p>
              <span className="text-muted-foreground">Type:</span>{" "}
              {consultationType === "video" ? "Video" : "In person"}
            </p>
            <p>
              <span className="text-muted-foreground">Fee:</span>{" "}
              {formatCurrency(feeCents, currency)}
            </p>
            <p className="text-xs text-muted-foreground pt-2">
              Offer expires{" "}
              {new Date(expiresAt).toLocaleString("en-GB", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {inactive && !result ? (
            <p className="text-sm text-muted-foreground">
              {expired
                ? "This offer has expired."
                : "This offer is no longer available."}
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1" onClick={accept} disabled={pending}>
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept this slot
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={decline}
                disabled={pending}
              >
                Decline &amp; refund
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
