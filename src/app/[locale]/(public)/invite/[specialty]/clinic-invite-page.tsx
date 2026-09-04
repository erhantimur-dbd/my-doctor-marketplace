import { resolveInviteToken } from "@/actions/clinic-invitations";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./invite-accept-client";
import type { Metadata } from "next";

export async function clinicInviteMetadata(token: string): Promise<Metadata> {
  const { invite } = await resolveInviteToken(token);
  const clinicName = invite?.organization?.name ?? "a clinic";
  return {
    title: `Join ${clinicName} — MyDoctors360`,
    description: `You've been invited to join ${clinicName} as part of their healthcare team.`,
    robots: { index: false },
  };
}

export async function ClinicInvitePage({
  locale,
  token,
}: {
  locale: string;
  token: string;
}) {
  const { invite, error } = await resolveInviteToken(token);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentProfile = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, email, role")
      .eq("id", user.id)
      .single();
    currentProfile = data;
  }

  return (
    <InviteAcceptClient
      token={token}
      invite={invite}
      inviteError={error}
      currentProfile={currentProfile}
      locale={locale}
    />
  );
}
