import { getOrgBookings } from "@/actions/org-dashboard";
import { getClinicDoctors } from "@/actions/clinic-booking";
import { requireOrgMember } from "@/actions/organization";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { OrgBookingsClient } from "./org-bookings-client";

export default async function OrgBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { error } = await requireOrgMember(["owner", "admin"]);
  if (error) redirect("/en/doctor-dashboard");

  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "past" || rawTab === "all" ? rawTab : "upcoming";

  const [bookingsResult, doctorsResult] = await Promise.all([
    getOrgBookings({ tab }),
    getClinicDoctors(),
  ]);

  const bookings = (bookingsResult.data || []) as any[];
  const doctors = (doctorsResult.doctors || []) as any[];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/doctor-dashboard/organization"
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">Organization Bookings</h1>
      </div>

      <OrgBookingsClient bookings={bookings} doctors={doctors} activeTab={tab} />
    </div>
  );
}
