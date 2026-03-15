"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Loader2 } from "lucide-react";
import { UpgradePrompt } from "./upgrade-prompt";

interface LicenseGateProps {
  children: React.ReactNode;
  feature: string;
  description?: string;
  /** Optional: require a specific tier feature (checked via tier→feature mapping) */
  requiredFeature?: string;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function LicenseGate({
  children,
  feature,
  description,
  requiredFeature,
}: LicenseGateProps) {
  const [status, setStatus] = useState<"loading" | "licensed" | "unlicensed">(
    "loading"
  );

  useEffect(() => {
    async function checkLicense() {
      try {
        const supabase = createSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setStatus("unlicensed");
          return;
        }

        // Check org-based license first
        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (membership) {
          const { data: license } = await supabase
            .from("licenses")
            .select("id, tier, status")
            .eq("organization_id", membership.organization_id)
            .in("status", ["active", "trialing", "past_due"])
            .limit(1)
            .maybeSingle();

          if (license) {
            // If a specific feature is required, check tier feature mapping
            if (requiredFeature) {
              const tierFeatures: Record<string, string[]> = {
                starter: ["profile", "bookings", "basic_analytics", "email_notifications", "crm"],
                professional: ["profile", "bookings", "basic_analytics", "email_notifications", "crm", "video", "treatment_plans", "advanced_analytics", "priority_support", "calendar_sync"],
                clinic: ["profile", "bookings", "basic_analytics", "email_notifications", "crm", "video", "treatment_plans", "advanced_analytics", "priority_support", "calendar_sync", "team_dashboard", "shared_calendar", "invoicing", "bulk_import", "staff_accounts"],
                enterprise: ["all"],
              };
              const features = tierFeatures[license.tier] || [];
              if (features.includes("all") || features.includes(requiredFeature)) {
                setStatus("licensed");
              } else {
                setStatus("unlicensed");
              }
            } else {
              setStatus("licensed");
            }
            return;
          }
        }

        setStatus("unlicensed");
      } catch {
        setStatus("unlicensed");
      }
    }

    checkLicense();
  }, [requiredFeature]);

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === "unlicensed") {
    return <UpgradePrompt feature={feature} description={description} />;
  }

  return <>{children}</>;
}
