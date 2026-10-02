"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  INVITED_MEMBER_ORGANIZATION_COLUMNS,
  publicOrganizationSelectList,
} from "@/lib/organizations/public-columns";

export type PendingOrganizationInvite = {
  organizationId: string;
  organizationName: string;
  role: string;
  inviterName: string | null;
  invitedAt: string;
};

/**
 * Name of the organization the signed-in user has been invited to.
 * Auth and the invited membership row are checked before the service-role
 * read. The organization id always comes from that membership, never from
 * the client.
 */
export async function getMyPendingOrganizationInvitation(): Promise<PendingOrganizationInvite | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("organization_members")
    .select(
      "user_id, organization_id, role, invited_at, inviter:profiles!organization_members_invited_by_fkey(first_name, last_name)"
    )
    .eq("user_id", user.id)
    .eq("status", "invited")
    .limit(1)
    .maybeSingle();

  if (!membership || membership.user_id !== user.id || !membership.organization_id) {
    return null;
  }

  const { data: org } = await admin
    .from("organizations")
    .select(publicOrganizationSelectList(INVITED_MEMBER_ORGANIZATION_COLUMNS))
    .eq("id", membership.organization_id)
    .maybeSingle();
  const organization = (org ?? null) as { name?: string | null } | null;

  const inviter = Array.isArray(membership.inviter) ? membership.inviter[0] : membership.inviter;

  return {
    organizationId: membership.organization_id,
    organizationName: organization?.name || "an organization",
    role: membership.role,
    inviterName: inviter ? `${inviter.first_name} ${inviter.last_name}` : null,
    invitedAt: membership.invited_at || "",
  };
}
