"use server";
import { safeError } from "@/lib/utils/safe-error";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import {
  createOrganizationSchema,
  updateOrganizationSchema,
  inviteMemberSchema,
  removeMemberSchema,
  updateMemberRoleSchema,
  transferOwnershipSchema,
} from "@/lib/validators/organization";
import { sendEmail } from "@/lib/email/client";
import { organizationInvitationEmail } from "@/lib/email/templates";

// ─── Helpers ────────────────────────────────────────────────

async function requireOrgMember(requiredRoles?: string[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", supabase: null, membership: null, org: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { error: "Not a member of any organization", supabase: null, membership: null, org: null };

  if (requiredRoles && !requiredRoles.includes(membership.role)) {
    return { error: "Insufficient permissions", supabase: null, membership: null, org: null };
  }

  const org: any = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;

  return { error: null, supabase, membership, org };
}

function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 50) +
    "-" +
    Math.random().toString(36).slice(2, 6)
  );
}

// ─── Actions ────────────────────────────────────────────────

export async function createOrganization(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const raw = {
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string) || undefined,
    email: (formData.get("email") as string) || undefined,
    phone: (formData.get("phone") as string) || undefined,
    website: (formData.get("website") as string) || undefined,
    timezone: (formData.get("timezone") as string) || undefined,
    base_currency: (formData.get("base_currency") as string) || undefined,
  };

  const parsed = createOrganizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const slug = parsed.data.slug || generateSlug(parsed.data.name);

  // Check user doesn't already own an org
  const { data: existing } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "owner")
    .maybeSingle();

  if (existing) return { error: "You already own an organization" };

  const adminSupabase = createAdminClient();

  const { data: newOrg, error: orgError } = await adminSupabase
    .from("organizations")
    .insert({
      name: parsed.data.name,
      slug,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      website: parsed.data.website || null,
      timezone: parsed.data.timezone || "Europe/London",
      base_currency: parsed.data.base_currency || "EUR",
    })
    .select("id")
    .single();

  if (orgError || !newOrg) return { error: orgError?.message || "Failed to create organization" };

  // Create owner membership
  await adminSupabase.from("organization_members").insert({
    organization_id: newOrg.id,
    user_id: user.id,
    role: "owner",
    status: "active",
    accepted_at: new Date().toISOString(),
  });

  // Link doctor to org if user is a doctor
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (doctor) {
    await adminSupabase
      .from("doctors")
      .update({ organization_id: newOrg.id })
      .eq("id", doctor.id);
  }

  revalidatePath("/doctor-dashboard");
  return { error: null, organizationId: newOrg.id };
}

export async function getMyOrganization() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", org: null, membership: null, license: null, members: null };

  const { data: membership } = await supabase
    .from("organization_members")
    .select("*, organization:organizations(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .single();

  if (!membership) return { error: null, org: null, membership: null, license: null, members: null };

  const org: any = Array.isArray(membership.organization)
    ? membership.organization[0]
    : membership.organization;

  // Fetch license
  const { data: license } = await supabase
    .from("licenses")
    .select("*")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due", "grace_period", "suspended"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch all members (only if owner/admin)
  let members: any[] = [];
  if (membership.role === "owner" || membership.role === "admin") {
    const { data: memberList } = await supabase
      .from("organization_members")
      .select("*, profile:profiles(first_name, last_name, email, avatar_url)")
      .eq("organization_id", org.id)
      .neq("status", "removed")
      .order("created_at", { ascending: true });
    members = memberList || [];
  }

  return { error: null, org, membership, license, members };
}

export async function updateOrganization(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError };

  const raw: Record<string, string | undefined> = {};
  for (const key of [
    "name", "email", "phone", "website",
    "address_line1", "address_line2", "city", "state",
    "postal_code", "country", "timezone", "base_currency",
  ]) {
    const val = formData.get(key) as string;
    if (val !== null && val !== undefined) raw[key] = val;
  }

  const parsed = updateOrganizationSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const { error: updateError } = await supabase
    .from("organizations")
    .update(parsed.data)
    .eq("id", org.id);

  if (updateError) return { error: safeError(updateError) };

  revalidatePath("/doctor-dashboard/organization");
  return { error: null };
}

export async function inviteMember(formData: FormData) {
  const { error: authError, supabase, org, membership } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError };

  const raw = {
    email: formData.get("email") as string,
    role: formData.get("role") as string,
  };

  const parsed = inviteMemberSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  // Check seat availability
  const { data: license } = await supabase
    .from("licenses")
    .select("max_seats, used_seats")
    .eq("organization_id", org.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (license && license.used_seats >= license.max_seats) {
    return { error: "No available seats. Please upgrade your plan or add extra seats." };
  }

  // Find user by email
  const adminSupabase = createAdminClient();
  const { data: inviteeProfile } = await adminSupabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .eq("email", parsed.data.email)
    .single();

  if (!inviteeProfile) {
    return { error: "No user found with this email. They must register first." };
  }

  // Check not already a member
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", org.id)
    .eq("user_id", inviteeProfile.id)
    .maybeSingle();

  if (existingMember && existingMember.status === "active") {
    return { error: "This user is already a member of your organization." };
  }

  if (existingMember) {
    // Re-invite removed/suspended member
    await adminSupabase
      .from("organization_members")
      .update({
        status: "invited",
        role: parsed.data.role,
        invited_by: membership!.user_id,
        invited_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);
  } else {
    await adminSupabase.from("organization_members").insert({
      organization_id: org.id,
      user_id: inviteeProfile.id,
      role: parsed.data.role,
      status: "invited",
      invited_by: membership!.user_id,
      invited_at: new Date().toISOString(),
    });
  }

  // Send invitation email
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // Get inviter's name
  const { data: inviterProfile } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", membership!.user_id)
    .single();

  const inviterName = inviterProfile
    ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
    : "Your colleague";
  const inviteeName = inviteeProfile.first_name || "there";
  const acceptUrl = `${origin}/en/doctor-dashboard/organization`;

  const { subject, html } = organizationInvitationEmail({
    inviteeName,
    organizationName: org.name,
    inviterName,
    role: parsed.data.role,
    acceptUrl,
  });

  sendEmail({
    to: inviteeProfile.email,
    subject,
    html,
  }).catch((err) => console.error("Invitation email error:", err));

  revalidatePath("/doctor-dashboard/organization/members");
  return { error: null };
}

export async function acceptInvitation(organizationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminSupabase = createAdminClient();

  const { data: invite } = await adminSupabase
    .from("organization_members")
    .select("id, organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", user.id)
    .eq("status", "invited")
    .single();

  if (!invite) return { error: "No pending invitation found" };

  // Accept membership
  await adminSupabase
    .from("organization_members")
    .update({
      status: "active",
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  // Link doctor to org if applicable
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (doctor) {
    await adminSupabase
      .from("doctors")
      .update({ organization_id: invite.organization_id })
      .eq("id", doctor.id);
  }

  // Increment used_seats on the license
  await adminSupabase.rpc("increment_used_seats", {
    org_id: invite.organization_id,
  });

  revalidatePath("/doctor-dashboard");
  return { error: null };
}

export async function removeMember(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError };

  const parsed = removeMemberSchema.safeParse({
    member_id: formData.get("member_id") as string,
  });
  if (!parsed.success) return { error: "Invalid member ID" };

  const adminSupabase = createAdminClient();

  // Can't remove the owner
  const { data: target } = await adminSupabase
    .from("organization_members")
    .select("id, role, user_id")
    .eq("id", parsed.data.member_id)
    .eq("organization_id", org.id)
    .single();

  if (!target) return { error: "Member not found" };
  if (target.role === "owner") return { error: "Cannot remove the organization owner" };

  await adminSupabase
    .from("organization_members")
    .update({ status: "removed" })
    .eq("id", parsed.data.member_id);

  // Unlink doctor from org
  await adminSupabase
    .from("doctors")
    .update({ organization_id: null })
    .eq("profile_id", target.user_id);

  // Decrement used_seats
  await adminSupabase.rpc("decrement_used_seats", {
    org_id: org.id,
  });

  revalidatePath("/doctor-dashboard/organization/members");
  return { error: null };
}

export async function updateMemberRole(formData: FormData) {
  const { error: authError, supabase, org } = await requireOrgMember(["owner"]);
  if (authError || !supabase || !org) return { error: authError };

  const parsed = updateMemberRoleSchema.safeParse({
    member_id: formData.get("member_id") as string,
    role: formData.get("role") as string,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const adminSupabase = createAdminClient();

  // Can't change the owner's role via this action
  const { data: target } = await adminSupabase
    .from("organization_members")
    .select("id, role")
    .eq("id", parsed.data.member_id)
    .eq("organization_id", org.id)
    .single();

  if (!target) return { error: "Member not found" };
  if (target.role === "owner") return { error: "Cannot change the owner's role. Use transfer ownership instead." };

  await adminSupabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", parsed.data.member_id);

  revalidatePath("/doctor-dashboard/organization/members");
  return { error: null };
}

export async function transferOwnership(formData: FormData) {
  const { error: authError, supabase, org, membership } = await requireOrgMember(["owner"]);
  if (authError || !supabase || !org || !membership) return { error: authError };

  const parsed = transferOwnershipSchema.safeParse({
    new_owner_id: formData.get("new_owner_id") as string,
  });
  if (!parsed.success) return { error: "Invalid input" };

  const adminSupabase = createAdminClient();

  // Verify new owner is an active member
  const { data: newOwnerMember } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", org.id)
    .eq("user_id", parsed.data.new_owner_id)
    .eq("status", "active")
    .single();

  if (!newOwnerMember) return { error: "New owner must be an active member of the organization" };

  // Demote current owner to admin
  await adminSupabase
    .from("organization_members")
    .update({ role: "admin" })
    .eq("id", membership.id);

  // Promote new owner
  await adminSupabase
    .from("organization_members")
    .update({ role: "owner" })
    .eq("id", newOwnerMember.id);

  revalidatePath("/doctor-dashboard/organization");
  return { error: null };
}
