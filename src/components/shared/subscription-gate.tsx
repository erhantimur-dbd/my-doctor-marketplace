"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/providers/auth-provider";
import { Loader2 } from "lucide-react";
import { UpgradePrompt } from "./upgrade-prompt";

interface SubscriptionGateProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
}

export function SubscriptionGate({
  children,
  feature,
  description,
}: SubscriptionGateProps) {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<"loading" | "subscribed" | "free">(
    "loading"
  );

  useEffect(() => {
    // AuthProvider already has the server-rendered session. A parallel
    // auth user fetch takes the Navigator lock and can leave this gate on
    // the spinner after the header has already painted the user.
    // Key on user id so a token refresh does not re-run this check.
    if (authLoading) return;

    let cancelled = false;

    async function checkSubscription() {
      if (!userId) {
        setStatus("free");
        return;
      }

      try {
        const supabase = createClient();
        const { data: doctor } = await supabase
          .from("doctors")
          .select("id, organization_id")
          .eq("profile_id", userId)
          .single();
        if (cancelled) return;
        if (!doctor) {
          setStatus("free");
          return;
        }

        // Founding Free grants lifetime Professional product entitlements
        if (doctor.organization_id) {
          const { data: licenses } = await supabase
            .from("licenses")
            .select("id, tier, status, created_at")
            .eq("organization_id", doctor.organization_id)
            .in("status", ["active", "trialing", "past_due"]);

          const { pickEffectiveLicense } = await import(
            "@/lib/license/tier-lifecycle"
          );
          const { hasProductEntitlements } = await import(
            "@/lib/utils/feature-flags"
          );
          const license = pickEffectiveLicense(licenses || []);
          if (cancelled) return;
          if (license && hasProductEntitlements(license.tier)) {
            setStatus("subscribed");
            return;
          }
        }

        setStatus("free");
      } catch {
        if (!cancelled) setStatus("free");
      }
    }

    void checkSubscription();
    return () => {
      cancelled = true;
    };
  }, [authLoading, userId]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "free") {
    return <UpgradePrompt feature={feature} description={description} />;
  }

  return <>{children}</>;
}
