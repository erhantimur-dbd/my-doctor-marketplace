import { Badge } from "@/components/ui/badge";
import type { PublicBookingView } from "@/lib/booking/find-booking";

export function BookingLookupResult({
  booking,
  children,
}: {
  booking: PublicBookingView;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          Booking number
        </p>
        <p className="mt-1 text-lg font-bold tracking-wider">
          {booking.bookingNumber}
        </p>
      </div>
      <dl className="space-y-2 text-sm">
        <Row label="Date" value={booking.dateLabel} />
        <Row label="Time" value={booking.timeLabel} />
        <Row label="Doctor" value={booking.doctorName} />
        <Row label="Consultation" value={booking.consultationLabel} />
        <Row label="Status" value={booking.statusLabel} />
        <Row label="Amount paid" value={booking.amountPaidLabel} />
      </dl>
      {booking.joinUrl ? (
        <a
          href={booking.joinUrl}
          className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          rel="noopener noreferrer"
        >
          Join waiting room
        </a>
      ) : (
        <p className="text-xs text-muted-foreground">
          A join link appears here for confirmed video appointments.
        </p>
      )}
      <Badge variant="secondary" className="w-full justify-center">
        Changes need a one-time link emailed to you
      </Badge>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
