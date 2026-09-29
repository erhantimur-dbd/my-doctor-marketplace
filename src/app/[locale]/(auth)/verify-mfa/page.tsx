import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { VerifyMfaForm } from "./verify-mfa-form";
import { isSafeRelativePath } from "@/lib/auth/return-cookie";
import { dashboardPathForRole } from "@/lib/auth/role-redirect";

export default async function VerifyMfaPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const supabase = await createClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const role = session.user?.user_metadata?.role as string | undefined;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal2") {
    redirect(dashboardPathForRole(locale, role));
  }

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verifiedTotp =
    factors?.totp?.filter((f) => f.status === "verified") ?? [];

  if (verifiedTotp.length === 0) {
    redirect(`/${locale}/login`);
  }

  const redirectTo =
    query.redirect && isSafeRelativePath(query.redirect)
      ? query.redirect
      : undefined;

  return (
    <VerifyMfaForm
      factors={verifiedTotp.map((f, i) => ({
        id: f.id,
        name: f.friendly_name || (i === 0 ? "Authenticator" : `Backup ${i}`),
      }))}
      accessToken={session.access_token}
      locale={locale}
      userRole={role}
      redirectTo={redirectTo}
    />
  );
}
