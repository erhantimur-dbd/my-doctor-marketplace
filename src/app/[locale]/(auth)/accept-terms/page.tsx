import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptTermsForm } from "./accept-terms-form";

export default async function AcceptTermsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const { next: rawNext } = await searchParams;

  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : `/${locale}/dashboard`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, terms_accepted_at, role")
    .eq("id", user.id)
    .single();

  // Already accepted — send to intended destination (or role home)
  if (profile?.terms_accepted_at) {
    redirect(next);
  }

  return (
    <AcceptTermsForm
      locale={locale}
      next={next}
      firstName={profile?.first_name || undefined}
    />
  );
}
