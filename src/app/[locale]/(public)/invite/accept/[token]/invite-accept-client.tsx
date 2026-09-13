"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Building2,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  Stethoscope,
  ShieldCheck,
  Users,
  Clock,
  LogIn,
  UserPlus,
} from "lucide-react";
import {
  acceptClinicInvitation,
  acceptClinicInvitationWithTransfer,
} from "@/actions/clinic-invitations";

interface ClinicInviteData {
  id: string;
  email: string;
  role: string;
  token: string;
  expires_at: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url: string | null;
    description: string | null;
  };
}

interface Props {
  token: string;
  invite: ClinicInviteData | null;
  inviteError: string | null;
  currentProfile: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  } | null;
  locale: string;
}

const ROLE_LABELS: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  doctor: {
    label: "Doctor",
    icon: <Stethoscope className="h-4 w-4" />,
    color: "bg-blue-100 text-blue-800",
  },
  admin: {
    label: "Clinic Administrator",
    icon: <ShieldCheck className="h-4 w-4" />,
    color: "bg-purple-100 text-purple-800",
  },
  staff: {
    label: "Staff Member",
    icon: <Users className="h-4 w-4" />,
    color: "bg-green-100 text-green-800",
  },
};

export function InviteAcceptClient({
  token,
  invite,
  inviteError,
  currentProfile,
  locale,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showTransferWarning, setShowTransferWarning] = useState(false);
  const [existingSubTier, setExistingSubTier] = useState<string | null>(null);

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-7 w-7 text-red-600" />
            </div>
            <CardTitle>Invitation Not Found</CardTitle>
            <CardDescription>
              {inviteError ||
                "This invitation link has expired or is no longer valid. Please ask your clinic administrator to send a new invitation."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => router.push(`/${locale}`)}>
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Email mismatch check (if logged in)
  const emailMismatch =
    currentProfile &&
    currentProfile.email.toLowerCase() !== invite.email.toLowerCase();

  const roleInfo = ROLE_LABELS[invite.role] ?? {
    label: invite.role,
    icon: <UserCheck className="h-4 w-4" />,
    color: "bg-gray-100 text-gray-800",
  };

  const expiresAt = new Date(invite.expires_at);
  const daysRemaining = Math.ceil(
    (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  async function handleAccept() {
    setLoading(true);
    setError(null);
    const result = await acceptClinicInvitation(token);
    setLoading(false);

    const r = result as any;
    if (r?.error) {
      setError(r.error);
      return;
    }

    if (r?.requiresSubscriptionTransfer) {
      setExistingSubTier(r.existingSubDetails?.tier ?? null);
      setShowTransferWarning(true);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      if (r?.requiresDoctorOnboarding) {
        router.push(`/${locale}/doctor-dashboard/clinic-onboarding`);
      } else {
        router.push(`/${locale}/doctor-dashboard/organization`);
      }
    }, 2000);
  }

  async function handleTransferConfirm() {
    setLoading(true);
    setError(null);
    const result = await acceptClinicInvitationWithTransfer(token);
    setLoading(false);

    const r2 = result as any;
    if (r2?.error) {
      setError(r2.error);
      setShowTransferWarning(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      if (r2?.requiresDoctorOnboarding) {
        router.push(`/${locale}/doctor-dashboard/clinic-onboarding`);
      } else {
        router.push(`/${locale}/doctor-dashboard/organization`);
      }
    }, 2000);
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <CardTitle>You&apos;ve Joined {invite.organization.name}!</CardTitle>
            <CardDescription>
              Welcome to the team. Redirecting you to your dashboard…
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-4">
        {/* Clinic card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              {invite.organization.logo_url ? (
                <img
                  src={invite.organization.logo_url}
                  alt={invite.organization.name}
                  className="h-14 w-14 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-sky-100">
                  <Building2 className="h-7 w-7 text-sky-600" />
                </div>
              )}
              <div>
                <CardTitle className="text-xl">{invite.organization.name}</CardTitle>
                {invite.organization.description && (
                  <CardDescription className="mt-0.5 text-sm">
                    {invite.organization.description}
                  </CardDescription>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">You&apos;re invited as</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${roleInfo.color}`}
                >
                  {roleInfo.icon}
                  {roleInfo.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">For email</span>
                <span className="text-sm font-medium">{invite.email}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Expires</span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                  {daysRemaining > 0 ? `in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}` : "today"}
                </span>
              </div>
            </div>

            {/* Role capabilities */}
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                What you&apos;ll have access to
              </p>
              <ul className="space-y-1.5">
                {invite.role === "doctor" ? (
                  <>
                    <CapItem>Manage your appointments and calendar</CapItem>
                    <CapItem>Access your patients and messages</CapItem>
                    <CapItem>Work across clinic locations</CapItem>
                    <CapItem>Keep your individual public profile</CapItem>
                  </>
                ) : (
                  <>
                    <CapItem>Centralised clinic dashboard</CapItem>
                    <CapItem>View and manage all appointments</CapItem>
                    <CapItem>Cancel &amp; reschedule on behalf of patients</CapItem>
                    <CapItem>Manage team members and locations</CapItem>
                  </>
                )}
              </ul>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {emailMismatch && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  You&apos;re signed in as <strong>{currentProfile?.email}</strong> but this
                  invitation was sent to <strong>{invite.email}</strong>. Please sign in with
                  the correct account.
                </AlertDescription>
              </Alert>
            )}

            {/* Transfer warning */}
            {showTransferWarning && (
              <Alert className="border-amber-200 bg-amber-50">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800">
                  <p className="font-medium mb-1">
                    You have an active {existingSubTier} subscription
                  </p>
                  <p className="text-sm mb-3">
                    Joining this clinic will cancel your current personal subscription. Your
                    appointments and profile will be maintained under the clinic&apos;s plan.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleTransferConfirm}
                      disabled={loading}
                    >
                      {loading ? "Processing…" : "Yes, join the clinic"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowTransferWarning(false)}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* CTA buttons */}
            {!showTransferWarning && (
              <>
                {currentProfile && !emailMismatch ? (
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleAccept}
                    disabled={loading}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    {loading ? "Joining…" : `Join ${invite.organization.name}`}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() =>
                        router.push(
                          `/${locale}/register?invite=${token}&email=${encodeURIComponent(invite.email)}&tab=sign-up`
                        )
                      }
                    >
                      <UserPlus className="mr-2 h-4 w-4" />
                      Create an account &amp; join
                    </Button>
                    <Button
                      className="w-full"
                      variant="outline"
                      size="lg"
                      onClick={() =>
                        router.push(
                          `/${locale}/login?invite=${token}&email=${encodeURIComponent(invite.email)}`
                        )
                      }
                    >
                      <LogIn className="mr-2 h-4 w-4" />
                      Sign in to existing account
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By accepting this invitation you agree to MyDoctors360&apos;s{" "}
          <a href={`/${locale}/terms`} className="underline">
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  );
}

function CapItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />
      {children}
    </li>
  );
}
