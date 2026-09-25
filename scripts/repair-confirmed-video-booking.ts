/**
 * Repair one confirmed booking that missed Daily room + doctor notify.
 *
 * Softsmoke charge-skip (before this finalize path) confirmed BK-20260925-A856
 * without Checkout, so video_room_url, daily_room_name, and the doctor
 * new_booking notification were never written.
 *
 * Safe to re-run: an existing room pair is left in place, and doctor notify
 * is skipped when a new_booking notification for that booking_id already exists.
 *
 * Production repair for Darren Been / Dr Vera Softsmoke (no rebook):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   SUPABASE_SERVICE_ROLE_KEY=... \
 *   DAILY_API_KEY=... \
 *   npx tsx scripts/repair-confirmed-video-booking.ts \
 *     7696f804-21ff-40bf-be4a-4d3c2aaa244d
 *
 * Run from the repo root on the commit that contains finalizeConfirmedBooking.
 * Does not send Soft CTA email and does not mint Founding Free licences.
 */
import { finalizeConfirmedBookingById } from "../src/lib/booking/finalize-confirmed-booking";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`Missing ${name}. Refusing to repair without it.`);
    process.exit(1);
  }
}

async function main() {
  const bookingId = process.argv[2]?.trim();

  if (!bookingId) {
    console.error(
      "Usage: npx tsx scripts/repair-confirmed-video-booking.ts <booking-uuid>"
    );
    console.error(
      "Production Softsmoke booking: 7696f804-21ff-40bf-be4a-4d3c2aaa244d (BK-20260925-A856)"
    );
    process.exit(1);
  }

  requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  requireEnv("DAILY_API_KEY");

  const result = await finalizeConfirmedBookingById(bookingId);
  console.log(JSON.stringify({ bookingId, ...result }, null, 2));

  if (!result.found) {
    console.error(
      "Booking was not found. Check SUPABASE_SERVICE_ROLE_KEY and the id."
    );
    process.exit(1);
  }

  if (result.consultationType === "video" && !result.videoRoomUrl) {
    console.error(
      "Video booking still has no room URL. Check DAILY_API_KEY and the script logs."
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
