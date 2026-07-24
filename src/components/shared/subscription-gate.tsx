"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { UpgradePrompt } from "./upgrade-prompt";

interface SubscriptionGateProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function SubscriptionGate({
  children,
  feature,
  description,
}: SubscriptionGateProps) {
  const [status, setStatus] = useState<"loading" | "subscribed" | "free">(
    "loading"
  );

  useEffect(() => {
    async function checkSubscription() {
      try {
        const supabase = createSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setStatus("free");
          return;
        }

        const { data: doctor } = await supabase
          .from("doctors")
          .select("id, organization_id")
          .eq("profile_id", user.id)
          .single();
        if (!doctor) {
          setStatus("free");
          return;
        }

        // Paid licence only (Founding Free is not "subscribed" for product gates)
        if (doctor.organization_id) {
          const { data: licenses } = await supabase
            .from("licenses")
            .select("id, tier, status, created_at")
            .eq("organization_id", doctor.organization_id)
            .in("status", ["active", "trialing", "past_due"]);

          const { pickEffectiveLicense, isPaidTier } = await import(
            "@/lib/license/tier-lifecycle"
          );
          const license = pickEffectiveLicense(licenses || []);
          if (license && isPaidTier(license.tier)) {
            setStatus("subscribed");
            return;
          }
        }

        setStatus("free");
      } catch {
        setStatus("free");
      }
    }

    checkSubscription();
  }, []);

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
