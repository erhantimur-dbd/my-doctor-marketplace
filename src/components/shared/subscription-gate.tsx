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
        .select("id")
        .eq("profile_id", user.id)
        .single();
      if (!doctor) {
        setStatus("free");
        return;
      }

      const { data: sub } = await supabase
        .from("doctor_subscriptions")
        .select("id")
        .eq("doctor_id", doctor.id)
        .in("status", ["active", "trialing", "past_due"])
        .limit(1)
        .maybeSingle();

      setStatus(sub ? "subscribed" : "free");
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
