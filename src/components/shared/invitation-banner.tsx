"use client";

import { useEffect, useState, useTransition } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Building2, Check, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitation, declineInvitation } from "@/actions/organization";
import { toast } from "sonner";

interface PendingInvite {
  organizationId: string;
  organizationName: string;
  role: string;
  inviterName: string | null;
  invitedAt: string;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export function InvitationBanner() {
  const [invite, setInvite] = useState<PendingInvite | null>(null);
  const [isAccepting, startAccepting] = useTransition();
  const [isDeclining, startDeclining] = useTransition();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    async function checkInvitations() {
      try {
        const supabase = createSupabase();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Check for pending invitations
        const { data: membership } = await supabase
          .from("organization_members")
          .select(
            `organization_id, role, invited_at,
             organization:organizations(name),
             inviter:profiles!organization_members_invited_by_fkey(first_name, last_name)`
          )
          .eq("user_id", user.id)
          .eq("status", "invited")
          .limit(1)
          .maybeSingle();

        if (!membership) return;

        const org: any = Array.isArray(membership.organization)
          ? membership.organization[0]
          : membership.organization;
        const inviter: any = Array.isArray(membership.inviter)
          ? membership.inviter[0]
          : membership.inviter;

        setInvite({
          organizationId: membership.organization_id,
          organizationName: org?.name || "an organization",
          role: membership.role,
          inviterName: inviter
            ? `${inviter.first_name} ${inviter.last_name}`
            : null,
          invitedAt: membership.invited_at || "",
        });
      } catch {
        // Silently fail
      }
    }

    checkInvitations();
  }, []);

  if (!invite || dismissed) return null;

  const handleAccept = () => {
    startAccepting(async () => {
      const result = await acceptInvitation(invite.organizationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`You've joined ${invite.organizationName}!`);
        setDismissed(true);
      }
    });
  };

  const handleDecline = () => {
    startDeclining(async () => {
      const result = await declineInvitation(invite.organizationId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Invitation declined.");
        setDismissed(true);
      }
    });
  };

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex items-center gap-3">
        <Building2 className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="flex-1 text-sm text-blue-800 dark:text-blue-200">
          {invite.inviterName ? (
            <>
              <strong>{invite.inviterName}</strong> invited you to join{" "}
            </>
          ) : (
            <>You&apos;ve been invited to join </>
          )}
          <strong>{invite.organizationName}</strong> as{" "}
          <span className="capitalize">{invite.role}</span>.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDecline}
            disabled={isDeclining || isAccepting}
          >
            {isDeclining ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <X className="mr-1.5 h-3.5 w-3.5" />
            )}
            Decline
          </Button>
          <Button
            size="sm"
            onClick={handleAccept}
            disabled={isAccepting || isDeclining}
          >
            {isAccepting ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            )}
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
