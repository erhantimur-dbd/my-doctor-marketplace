import { redirect } from "next/navigation";

/**
 * Legacy subscription page — now redirects to organization billing.
 * All subscription management is handled through the org-based licenses system.
 */
export default function SubscriptionPage() {
  redirect("/doctor-dashboard/organization/billing");
}
