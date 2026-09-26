-- Soft-expire unpaid Checkout bookings instead of hard-delete.
-- Hard-delete raced with late Stripe checkout.session.completed (money taken,
-- booking gone). Status `expired` keeps the row for webhook refund/alert.

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_status_check;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_status_check CHECK (
    status IN (
      'pending_payment',
      'confirmed',
      'pending_approval',
      'approved',
      'rejected',
      'completed',
      'cancelled_patient',
      'cancelled_doctor',
      'no_show',
      'refunded',
      'pending_reschedule_payment',
      'expired'
    )
  );
