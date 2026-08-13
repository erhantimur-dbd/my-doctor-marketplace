import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AcceptTermsForm } from "./accept-terms-form";
import {
  isSafeRelativePath,
  sanitizeAuthLocale,
} from "@/lib/auth/return-cookie";

export default async function AcceptTermsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale: localeParam } = await params;
  const locale = sanitizeAuthLocale(localeParam);
  const { next: rawNext } = await searchParams;

  const next =
    rawNext && isSafeRelativePath(rawNext)
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
