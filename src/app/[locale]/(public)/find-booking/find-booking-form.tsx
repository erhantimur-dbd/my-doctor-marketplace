"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BookingLookupResult } from "@/components/booking/booking-lookup-result";
import {
  lookupGuestBooking,
  requestBookingManageLink,
} from "@/actions/find-booking";
import type { PublicBookingView } from "@/lib/booking/find-booking";

export function FindBookingForm({ locale }: { locale: string }) {
  const [bookingNumber, setBookingNumber] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [booking, setBooking] = useState<PublicBookingView | null>(null);
  const [pending, startTransition] = useTransition();

  function onLookup(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBooking(null);
    startTransition(async () => {
      const result = await lookupGuestBooking({ bookingNumber, email });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBooking(result.booking);
    });
  }

  function onRequestLink() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await requestBookingManageLink({
        bookingNumber,
        email,
        locale,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setNotice(
        "We sent a one-time link to the email used to book. It expires in 30 minutes and works once. Cancel and reschedule are on the page that link opens."
      );
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onLookup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="booking-number">Booking number</Label>
          <Input
            id="booking-number"
            name="bookingNumber"
            autoComplete="off"
            required
            value={bookingNumber}
            onChange={(event) => setBookingNumber(event.target.value)}
            placeholder="MD-7K3Q9X or BK-20260926-2FB5"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="booking-email">Email used to book</Label>
          <Input
            id="booking-email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          We match this email to the booking and, if you ask, send a one-time
          link to that address. This page shows the appointment only. It does
          not include clinical notes or other patient details.
        </p>
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Looking up…" : "Find booking"}
        </Button>
      </form>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-muted-foreground" role="status">
          {notice}
        </p>
      ) : null}

      {booking ? (
        <BookingLookupResult booking={booking}>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={onRequestLink}
          >
            Email me a link to change this booking
          </Button>
        </BookingLookupResult>
      ) : null}
    </div>
  );
}
