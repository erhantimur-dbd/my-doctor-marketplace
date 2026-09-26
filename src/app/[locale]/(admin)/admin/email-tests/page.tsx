import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { EmailTestPanel } from "./email-test-panel";

export default async function AdminEmailTestsPage() {
  const { user } = await requireAdminPage();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Email Template Testing</h1>
        <p className="text-muted-foreground">
          Send test emails for all 24 templates to verify formatting and delivery.
        </p>
      </div>
      <EmailTestPanel userEmail={user.email || ""} />
    </div>
  );
}
