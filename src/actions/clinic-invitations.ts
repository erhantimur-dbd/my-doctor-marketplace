"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { requireOrgMember } from "./organization";
import { sendEmail } from "@/lib/email/client";
import { clinicInvitationEmail } from "@/lib/email/templates";
import { log } from "@/lib/utils/logger";
import { getStripe } from "@/lib/stripe/client";
import { z } from "zod/v4";
import type { ClinicInvitation, ClinicInvitationRole } from "@/types";

// ─── Validators ──────────────────────────────────────────────

const sendInviteSchema = z.object({
  email: z.email(),
  role: z.enum(["doctor", "admin", "staff"]),
  location_ids: z.array(z.string().uuid()).default([]),
});

// ─── Read ────────────────────────────────────────────────────

/** Get all pending/active invitations for the org (admin view) */
export async function getClinicInvitations() {
  const { error: authError, supabase, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !supabase || !org) return { error: authError, invitations: [] };

  const { data, error } = await supabase
    .from("clinic_invitations")
    .select(`
      *,
      inviter:profiles!clinic_invitations_invited_by_fkey(first_name, last_name, email)
    `)
    .eq("organization_id", org.id)
    .order("created_at", { ascending: false });

  if (error) return { error: error.message, invitations: [] };
  return { error: null, invitations: data ?? [] };
}

/** Resolve an invitation token — called on the public /invite/[token] page */
export async function resolveInviteToken(token: string) {
  const adminSupabase = createAdminClient();

  const { data: invite, error } = await adminSupabase
    .from("clinic_invitations")
    .select(`
      *,
      organization:organizations(id, name, slug, logo_url, description)
    `)
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (error || !invite) return { error: "Invitation not found or has expired", invite: null };

  const org: any = Array.isArray(invite.organization)
    ? invite.organization[0]
    : invite.organization;

  return { error: null, invite: { ...invite, organization: org } };
}

/** Check if an email already has an account */
export async function checkEmailRegistered(email: string) {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return { registered: !!data };
}

// ─── Send Invitation ─────────────────────────────────────────

export async function sendClinicInvitation(formData: FormData) {
  const { error: authError, org, membership } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org || !membership) return { error: authError };

  const locationIdsRaw = formData.get("location_ids") as string;
  const parsed = sendInviteSchema.safeParse({
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    location_ids: locationIdsRaw ? JSON.parse(locationIdsRaw) : [],
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  const adminSupabase = createAdminClient();

  // Check doctor seat availability (only for doctor role invites)
  if (parsed.data.role === "doctor") {
    const { data: license } = await adminSupabase
      .from("licenses")
      .select("max_seats, used_seats")
      .eq("organization_id", org.id)
      .in("status", ["active", "trialing", "past_due"])
      .limit(1)
      .maybeSingle();

    if (license && license.used_seats >= license.max_seats) {
      return { error: "No available doctor seats. Please add extra seats or upgrade your plan." };
    }
  }

  // Check for existing pending invite to same email in this org
  const { data: existing } = await adminSupabase
    .from("clinic_invitations")
    .select("id, status")
    .eq("organization_id", org.id)
    .eq("email", parsed.data.email.toLowerCase())
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    // Revoke old invite and re-send fresh one
    await adminSupabase
      .from("clinic_invitations")
      .update({ status: "revoked" })
      .eq("id", existing.id);
  }

  // Check if already an active org member
  const { data: existingProfile } = await adminSupabase
    .from("profiles")
    .select("id")
    .eq("email", parsed.data.email.toLowerCase())
    .maybeSingle();

  if (existingProfile) {
    const { data: existingMember } = await adminSupabase
      .from("organization_members")
      .select("id, status")
      .eq("organization_id", org.id)
      .eq("user_id", existingProfile.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingMember) {
      return { error: "This person is already an active member of your clinic." };
    }
  }

  // Create invitation with generated token
  const { data: invite, error: inviteError } = await adminSupabase
    .from("clinic_invitations")
    .insert({
      organization_id: org.id,
      email: parsed.data.email.toLowerCase(),
      role: parsed.data.role,
      invited_by: membership.user_id,
      location_ids: parsed.data.location_ids,
      // token and expires_at have DB defaults
    })
    .select("token")
    .single();

  if (inviteError || !invite) return { error: inviteError?.message || "Failed to create invitation" };

  // Build invite URL
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = host
    ? `${proto}://${host}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const inviteUrl = `${origin}/en/invite/${invite.token}`;

  // Get inviter name
  const { data: inviterProfile } = await adminSupabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", membership.user_id)
    .single();

  const inviterName = inviterProfile
    ? `${inviterProfile.first_name} ${inviterProfile.last_name}`
    : "Your clinic";

  const { subject, html } = clinicInvitationEmail({
    recipientEmail: parsed.data.email,
    clinicName: org.name,
    inviterName,
    role: parsed.data.role as ClinicInvitationRole,
    inviteUrl,
    expiryDays: 7,
  });

  sendEmail({ to: parsed.data.email, subject, html }).catch((err) =>
    log.error("Clinic invite email error:", { err })
  );

  revalidatePath("/doctor-dashboard/organization/members");
  return { error: null, token: invite.token };
}

export async function revokeClinicInvitation(invitationId: string) {
  const { error: authError, org } = await requireOrgMember(["owner", "admin"]);
  if (authError || !org) return { error: authError };

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase
    .from("clinic_invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId)
    .eq("organization_id", org.id)
    .eq("status", "pending");

  if (error) return { error: error.message };

  revalidatePath("/doctor-dashboard/organization/members");
  return { error: null };
}

// ─── Accept Invitation (existing user) ───────────────────────

export async function acceptClinicInvitation(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminSupabase = createAdminClient();

  const { data: invite } = await adminSupabase
    .from("clinic_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invite) return { error: "Invitation not found or has expired" };

  // Verify email matches
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("email, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.email.toLowerCase() !== invite.email.toLowerCase()) {
    return { error: "This invitation was sent to a different email address." };
  }

  // Check if already a member
  const { data: existingMember } = await adminSupabase
    .from("organization_members")
    .select("id, status")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember?.status === "active") {
    return { error: "You are already a member of this clinic." };
  }

  // Check if they have their own active subscription (doctor joining clinic)
  let hasExistingSubscription = false;
  let existingSubDetails: { tier: string; monthlyPence: number } | null = null;

  if (invite.role === "doctor") {
    const { data: existingOrg } = await adminSupabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle();

    if (existingOrg) {
      const { data: existingLicense } = await adminSupabase
        .from("licenses")
        .select("tier, stripe_subscription_id")
        .eq("organization_id", existingOrg.organization_id)
        .in("status", ["active", "trialing"])
        .single();

      if (existingLicense?.stripe_subscription_id) {
        hasExistingSubscription = true;
        existingSubDetails = {
          tier: existingLicense.tier,
          monthlyPence: 0, // app can display tier name
        };
      }
    }
  }

  // Return warning if they have an existing sub — frontend must confirm
  if (hasExistingSubscription) {
    return {
      error: null,
      requiresSubscriptionTransfer: true,
      existingSubDetails,
      token,
    };
  }

  return await _completeInviteAcceptance(invite, user.id, adminSupabase);
}

/** Called after user confirms they want to cancel their existing subscription */
export async function acceptClinicInvitationWithTransfer(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const adminSupabase = createAdminClient();

  const { data: invite } = await adminSupabase
    .from("clinic_invitations")
    .select("*")
    .eq("token", token)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invite) return { error: "Invitation not found or has expired" };

  // Cancel existing personal subscription
  const { data: existingOrg } = await adminSupabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (existingOrg) {
    const { data: existingLicense } = await adminSupabase
      .from("licenses")
      .select("stripe_subscription_id")
      .eq("organization_id", existingOrg.organization_id)
      .in("status", ["active", "trialing"])
      .single();

    if (existingLicense?.stripe_subscription_id) {
      try {
        const stripe = getStripe();
        await stripe.subscriptions.cancel(existingLicense.stripe_subscription_id);
        await adminSupabase
          .from("licenses")
          .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
          .eq("stripe_subscription_id", existingLicense.stripe_subscription_id);
      } catch (err) {
        log.error("Failed to cancel existing subscription during invite transfer:", { err });
        return { error: "Failed to cancel your existing subscription. Please contact support." };
      }
    }

    // Remove from old org
    await adminSupabase
      .from("organization_members")
      .update({ status: "removed" })
      .eq("organization_id", existingOrg.organization_id)
      .eq("user_id", user.id);
  }

  return await _completeInviteAcceptance(invite, user.id, adminSupabase);
}

async function _completeInviteAcceptance(
  invite: ClinicInvitation,
  userId: string,
  adminSupabase: ReturnType<typeof createAdminClient>
) {
  // Upsert org member
  const { data: existingMember } = await adminSupabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    await adminSupabase
      .from("organization_members")
      .update({
        status: "active",
        role: invite.role,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", existingMember.id);
  } else {
    await adminSupabase.from("organization_members").insert({
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role,
      status: "active",
      invited_by: invite.invited_by,
      invited_at: invite.created_at,
      accepted_at: new Date().toISOString(),
    });
  }

  // If doctor: link doctor record to org + assign to locations + increment seats
  if (invite.role === "doctor") {
    const { data: doctor } = await adminSupabase
      .from("doctors")
      .select("id")
      .eq("profile_id", userId)
      .maybeSingle();

    if (doctor) {
      await adminSupabase
        .from("doctors")
        .update({ organization_id: invite.organization_id })
        .eq("id", doctor.id);

      // Assign to pre-selected locations
      if (invite.location_ids && invite.location_ids.length > 0) {
        const assignments = invite.location_ids.map((lid: string) => ({
          doctor_id: doctor.id,
          clinic_location_id: lid,
          organization_id: invite.organization_id,
          is_active: true,
        }));
        await adminSupabase
          .from("doctor_location_assignments")
          .upsert(assignments, { onConflict: "doctor_id,clinic_location_id" });
      }

      // Increment used_seats (only for doctor role)
      await adminSupabase.rpc("increment_used_seats", {
        org_id: invite.organization_id,
        p_member_role: "doctor",
      });
    }
  }

  // Mark invitation as accepted
  await adminSupabase
    .from("clinic_invitations")
    .update({
      status: "accepted",
      accepted_by: userId,
      accepted_at: new Date().toISOString(),
    })
    .eq("id", invite.id);

  revalidatePath("/doctor-dashboard");
  return {
    error: null,
    requiresDoctorOnboarding: invite.role === "doctor",
    organizationId: invite.organization_id,
  };
}

// ─── New user signup via invite link ─────────────────────────
// This is called AFTER the new user has completed Supabase signup.
// The invite token is stored in their session metadata / passed as param.

export async function claimInviteAfterSignup(token: string) {
  // Same as acceptClinicInvitation — re-uses the same flow
  return acceptClinicInvitation(token);
}
