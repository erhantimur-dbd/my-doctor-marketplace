import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerifyMfaForm } from "./verify-mfa-form";

export default async function VerifyMfaPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const supabase = await createClient();

  // Get session + factor info server-side (no NavigatorLock issues)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp = factors?.totp?.find((f) => f.status === "verified");

  if (!verifiedTotp) {
    redirect(`/${locale}/login`);
  }

  // Get user role for post-verify redirect
  const role = session.user?.user_metadata?.role as string | undefined;

  return (
    <VerifyMfaForm
      factorId={verifiedTotp.id}
      accessToken={session.access_token}
      locale={locale}
      userRole={role}
    />
  );
}
