import { redirect } from "next/navigation";

/**
 * Surveys UI lives at /admin/nps (shared analytics helpers).
 * Keep this path so older dashboard/deep links still resolve.
 */
export default async function AdminSurveysRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin/nps`);
}
