import { redirect } from "next/navigation";

/**
 * Subscriptions overview lives under Licenses (MRR / tier source of truth).
 * Keep this path so dashboard deep-links and bookmarks still work.
 */
export default async function AdminSubscriptionsRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin/licenses`);
}
