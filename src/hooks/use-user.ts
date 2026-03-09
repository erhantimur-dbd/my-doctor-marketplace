"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

export interface OrgContext {
  orgId: string;
  orgName: string;
  orgRole: string;
  licenseTier: string | null;
  licenseStatus: string | null;
}

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { user, loading };
}

/**
 * Hook that fetches the current user's organization context.
 * Includes org details, membership role, and license info.
 */
export function useOrgContext() {
  const [orgContext, setOrgContext] = useState<OrgContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrgContext() {
      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }

        const { data: membership } = await supabase
          .from("organization_members")
          .select("role, organization:organizations(id, name)")
          .eq("user_id", user.id)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();

        if (!membership) {
          setLoading(false);
          return;
        }

        const org: any = Array.isArray(membership.organization)
          ? membership.organization[0]
          : membership.organization;

        if (!org) {
          setLoading(false);
          return;
        }

        // Fetch license
        const { data: license } = await supabase
          .from("licenses")
          .select("tier, status")
          .eq("organization_id", org.id)
          .in("status", [
            "active",
            "trialing",
            "past_due",
            "grace_period",
            "suspended",
          ])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setOrgContext({
          orgId: org.id,
          orgName: org.name,
          orgRole: membership.role,
          licenseTier: license?.tier || null,
          licenseStatus: license?.status || null,
        });
      } catch {
        // Silently fail
      }
      setLoading(false);
    }

    fetchOrgContext();
  }, []);

  return { orgContext, loading };
}
