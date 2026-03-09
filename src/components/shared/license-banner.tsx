"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { AlertTriangle, XCircle, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

type BannerLevel = "none" | "warning" | "danger" | "critical";

interface LicenseInfo {
  level: BannerLevel;
  status: string;
  daysRemaining?: number;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function LicenseBanner() {
  const [info, setInfo] = useState<LicenseInfo | null>(null);

  useEffect(() => {
    async function checkLicense() {
      try {
        const supabase = createSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        const { data: membership } = await supabase
          .from("organization_members")
          .select("organization_id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!membership) return;

        const { data: license } = await supabase
          .from("licenses")
          .select("status, current_period_end, grace_period_start, suspended_at")
          .eq("organization_id", membership.organization_id)
          .in("status", ["past_due", "grace_period", "suspended"])
          .limit(1)
          .maybeSingle();

        if (!license) {
          setInfo({ level: "none", status: "" });
          return;
        }

        let level: BannerLevel = "none";
        let daysRemaining: number | undefined;
        const now = Date.now();

        switch (license.status) {
          case "past_due": {
            level = "warning";
            const periodEnd = new Date(license.current_period_end).getTime();
            const graceDeadline = periodEnd + 7 * 24 * 60 * 60 * 1000;
            daysRemaining = Math.max(0, Math.ceil((graceDeadline - now) / (24 * 60 * 60 * 1000)));
            break;
          }
          case "grace_period": {
            level = "danger";
            if (license.grace_period_start) {
              const start = new Date(license.grace_period_start).getTime();
              const suspendDeadline = start + 30 * 24 * 60 * 60 * 1000;
              daysRemaining = Math.max(0, Math.ceil((suspendDeadline - now) / (24 * 60 * 60 * 1000)));
            }
            break;
          }
          case "suspended":
            level = "critical";
            break;
        }

        setInfo({ level, status: license.status, daysRemaining });
      } catch {
        // Silently fail — don't block the UI
      }
    }

    checkLicense();
  }, []);

  if (!info || info.level === "none") return null;

  if (info.level === "warning") {
    return (
      <div className="border-b border-yellow-300 bg-yellow-50 px-4 py-3 dark:border-yellow-700 dark:bg-yellow-950/30">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-600 dark:text-yellow-400" />
          <p className="flex-1 text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Payment overdue.</strong> Please update your payment method to avoid service interruption.
            {info.daysRemaining !== undefined && (
              <span> ({info.daysRemaining} days remaining)</span>
            )}
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href="/doctor-dashboard/organization/billing">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Update Payment
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (info.level === "danger") {
    return (
      <div className="border-b border-red-300 bg-red-50 px-4 py-3 dark:border-red-700 dark:bg-red-950/30">
        <div className="flex items-center gap-3">
          <XCircle className="h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
          <p className="flex-1 text-sm text-red-800 dark:text-red-200">
            <strong>Service limited.</strong> Your profile is hidden from search and new bookings are paused.
            {info.daysRemaining !== undefined && (
              <span> Account will be suspended in {info.daysRemaining} days.</span>
            )}
          </p>
          <Button size="sm" variant="destructive" asChild>
            <Link href="/doctor-dashboard/organization/billing">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" />
              Fix Billing
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // critical — suspended
  return (
    <div className="border-b border-red-500 bg-red-100 px-4 py-4 dark:border-red-600 dark:bg-red-950/50">
      <div className="flex items-center gap-3">
        <XCircle className="h-6 w-6 shrink-0 text-red-700 dark:text-red-400" />
        <p className="flex-1 text-sm font-medium text-red-900 dark:text-red-100">
          <strong>Account suspended.</strong> Your practice is no longer visible to patients. Reactivate your subscription to restore access.
        </p>
        <Button size="sm" variant="destructive" asChild>
          <Link href="/doctor-dashboard/organization/billing">
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Reactivate
          </Link>
        </Button>
      </div>
    </div>
  );
}
