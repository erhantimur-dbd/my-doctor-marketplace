"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Fingerprint, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { dashboardPathForRole } from "@/lib/auth/role-redirect";
import { isSafeRelativePath } from "@/lib/auth/return-cookie";
import {
  browserSupportsPasskeys,
  hostMatchesWebAuthnRp,
} from "@/lib/auth/webauthn";
import {
  isUserCancelledPasskey,
  passkeyErrorMessage,
} from "@/lib/auth/passkey-errors";

export function PasskeySignInButton({
  locale,
  redirectTo,
  onError,
}: {
  locale: string;
  redirectTo?: string;
  onError: (message: string) => void;
}) {
  const t = useTranslations("passkeys");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [available] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      browserSupportsPasskeys() && hostMatchesWebAuthnRp(window.location.hostname)
    );
  });

  if (!available) return null;

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    onError("");
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPasskey();
      if (error) {
        if (!isUserCancelledPasskey(error)) {
          onError(passkeyErrorMessage(error, t("error_sign_in")));
        }
        setBusy(false);
        return;
      }

      const user = data.user;
      if (user && !user.email_confirmed_at) {
        await supabase.auth.signOut();
        onError(t("error_unverified"));
        setBusy(false);
        return;
      }

      const { data: aal } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal2" && aal?.currentLevel === "aal1") {
        const qs =
          redirectTo && isSafeRelativePath(redirectTo)
            ? `?redirect=${encodeURIComponent(redirectTo)}`
            : "";
        router.push(`/${locale}/verify-mfa${qs}`);
        return;
      }

      const role = user?.user_metadata?.role as string | undefined;
      const dest =
        redirectTo && isSafeRelativePath(redirectTo)
          ? redirectTo
          : dashboardPathForRole(locale, role);
      window.location.href = dest;
    } catch (err) {
      if (!isUserCancelledPasskey(err)) {
        onError(passkeyErrorMessage(err, t("error_sign_in")));
      }
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-11 w-full"
      onClick={handleClick}
      disabled={busy}
    >
      {busy ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Fingerprint className="mr-2 h-4 w-4" />
      )}
      {t("sign_in")}
    </Button>
  );
}
