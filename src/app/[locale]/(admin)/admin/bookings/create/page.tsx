import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { AdminBookingWizard } from "./admin-booking-wizard";

export default async function AdminCreateBookingPage() {
  await requireAdminPage();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Create Booking on Behalf of Patient</h1>
      <AdminBookingWizard />
    </div>
  );
}
