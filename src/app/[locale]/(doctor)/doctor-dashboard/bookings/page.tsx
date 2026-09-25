import { UpgradePrompt } from "@/components/shared/upgrade-prompt";
import { loadDoctorBookingsForSession } from "@/lib/doctor/load-doctor-bookings";
import { BookingsClient } from "./bookings-client";

export default async function BookingsPage() {
  try {
    const access = await loadDoctorBookingsForSession();
    if (access.status === "subscribed") {
      return (
        <BookingsClient
          initial={{
            doctorId: access.doctorId,
            doctorCurrency: access.doctorCurrency,
            bookings: access.bookings,
            reschedules: access.reschedules,
          }}
        />
      );
    }
    if (access.status === "free") {
      return <UpgradePrompt feature="Bookings" />;
    }
  } catch {
    // Cookie session read failed. Fall through to the client gate.
  }

  return <BookingsClient />;
}
