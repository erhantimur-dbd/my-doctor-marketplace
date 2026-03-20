import { resolveInviteToken } from "@/actions/clinic-invitations";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./invite-accept-client";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const { invite } = await resolveInviteToken(token);
  const clinicName = invite?.organization?.name ?? "a clinic";
  return {
    title: `Join ${clinicName} — MyDoctors360`,
    description: `You've been invited to join ${clinicName} as part of their healthcare team.`,
    robots: { index: false },
  };
}

export default async function InviteAcceptPage({ params }: Props) {
  const { locale, token } = await params;

  const { invite, error } = await resolveInviteToken(token);

  // Get current session (if any)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
