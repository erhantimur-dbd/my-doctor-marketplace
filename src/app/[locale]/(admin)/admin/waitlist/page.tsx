import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { WaitlistDashboard } from "./waitlist-dashboard";
import {
  getAdminWaitlistDoctors,
  getAdminLaunchNotifications,
  getWaitlistAnalytics,
} from "@/actions/waitlist";
import { getSpecialtyDemandForAdmin } from "@/actions/availability-alerts";

export default async function AdminWaitlistPage() {
  await requireAdminPage();

  const [doctorsRes, patientsRes, analyticsRes, demandRes] = await Promise.all([
    getAdminWaitlistDoctors(),
    getAdminLaunchNotifications(),
    getWaitlistAnalytics(),
    getSpecialtyDemandForAdmin(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Waitlist &amp; demand</h1>
        <p className="text-sm text-muted-foreground">
          Patient specialty demand (recruiting signal), doctor waitlists, and
          launch-region interest
        </p>
      </div>
      <WaitlistDashboard
        doctors={doctorsRes.data || []}
        patients={patientsRes.data || []}
        analytics={analyticsRes.data}
        specialtyDemand={{
          rows: demandRes.rows,
          summary: demandRes.summary,
          totalActive: demandRes.totalActive,
        }}
      />
    </div>
  );
}
