import { redirect } from "next/navigation";

/**
 * Legacy subscription page — redirects to organization billing.
 * Preserves checkout resume query params from paid signup cancel URL.
 */
export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const key of ["checkout", "tier", "success"]) {
    const v = sp[key];
    if (typeof v === "string" && v) qs.set(key, v);
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  redirect(`/doctor-dashboard/organization/billing${suffix}`);
}
