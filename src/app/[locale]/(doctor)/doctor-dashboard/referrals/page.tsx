import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserPlus,
  Gift,
  Users,
  CheckCircle2,
  Crown,
  Link2,
} from "lucide-react";
import { CopyButton, InviteForm } from "./referral-form";
import { UpgradePrompt } from "@/components/shared/upgrade-prompt";

const statusColors: Record<string, string> = {
  invited: "bg-blue-100 text-blue-700",
  signed_up: "bg-amber-100 text-amber-700",
  subscribed: "bg-emerald-100 text-emerald-700",
  rewarded: "bg-purple-100 text-purple-700",
  expired: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  invited: "Invited",
  signed_up: "Signed Up",
  subscribed: "Subscribed",
  rewarded: "Rewarded",
  expired: "Expired",
};

export default async function DoctorReferralsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  // Get doctor with referral code
  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, referral_code")
    .eq("profile_id", user.id)
    .single();

  if (!doctor) redirect("/en/register-doctor");

  const { data: subscription } = await supabase
    .from("doctor_subscriptions")
    .select("id")
    .eq("doctor_id", doctor.id)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!subscription) {
    return <UpgradePrompt feature="Referrals" />;
  }

  // Get referrals
  const { data: referrals } = await supabase
    .from("doctor_referrals")
    .select("*")
    .eq("referrer_doctor_id", doctor.id)
    .order("created_at", { ascending: false });

  const all = referrals || [];
  const stats = {
    totalInvited: all.length,
    signedUp: all.filter((r: any) =>
      ["signed_up", "subscribed", "rewarded"].includes(r.status)
    ).length,
    subscribed: all.filter((r: any) =>
      ["subscribed", "rewarded"].includes(r.status)
    ).length,
    rewarded: all.filter((r: any) => r.status === "rewarded").length,
  };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const referralLink = `${appUrl}/en/register-doctor?ref=${doctor.referral_code}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <UserPlus className="h-6 w-6 text-emerald-600" />
        <h1 className="text-2xl font-bold">Referral Program</h1>
        <Badge className="bg-emerald-100 text-emerald-700">
          <Gift className="mr-1 h-3 w-3" />
          Earn 1 Month Free
        </Badge>
      </div>

      <p className="text-muted-foreground">
        Invite colleagues to join MyDoctor. When they subscribe, you both get 1
        month free on your subscription plan.
      </p>

      {/* Referral Code & Link */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-emerald-600" />
              Your Referral Code
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="flex-1 rounded-lg bg-muted px-4 py-3 text-center text-xl font-bold tracking-[4px]">
                {doctor.referral_code}
              </code>
              <CopyButton text={doctor.referral_code} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Link2 className="h-4 w-4 text-blue-600" />
              Share Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <code className="flex-1 truncate rounded-lg bg-muted px-4 py-3 text-sm">
                {referralLink}
              </code>
              <CopyButton text={referralLink} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-blue-50 p-3">
              <UserPlus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Invites Sent</p>
              <p className="text-2xl font-bold">{stats.totalInvited}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-amber-50 p-3">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Signed Up</p>
              <p className="text-2xl font-bold">{stats.signedUp}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-emerald-50 p-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Subscribed</p>
              <p className="text-2xl font-bold">{stats.subscribed}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="rounded-full bg-purple-50 p-3">
              <Crown className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Rewards Earned</p>
              <p className="text-2xl font-bold">{stats.rewarded}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Invite a Colleague
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InviteForm />
        </CardContent>
      </Card>

      {/* Referrals Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Invited</TableHead>
                <TableHead>Signed Up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {all.map((referral: any) => (
                <TableRow key={referral.id}>
                  <TableCell className="font-medium">
                    {referral.referred_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {referral.referred_email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        statusColors[referral.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {statusLabels[referral.status] || referral.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {referral.invitation_sent_at
                      ? new Date(
                          referral.invitation_sent_at
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {referral.signed_up_at
                      ? new Date(referral.signed_up_at).toLocaleDateString(
                          "en-GB",
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }
                        )
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {all.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No referrals yet. Invite a colleague to get started!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
