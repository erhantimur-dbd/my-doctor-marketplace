import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gift, Users, CalendarCheck, Coins, UserPlus } from "lucide-react";
import { getOrCreateReferralCode, getPatientReferrals } from "@/actions/patient";
import { CopyReferralLink } from "./copy-referral-link";
import { headers } from "next/headers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referrals",
};

function statusBadge(status: string) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="outline" className="text-yellow-700 border-yellow-300 bg-yellow-50">
          Pending
        </Badge>
      );
    case "signed_up":
      return (
        <Badge variant="outline" className="text-blue-700 border-blue-300 bg-blue-50">
          Signed Up
        </Badge>
      );
    case "booked":
      return (
        <Badge variant="outline" className="text-purple-700 border-purple-300 bg-purple-50">
          Booked
        </Badge>
      );
    case "credited":
      return (
        <Badge variant="default" className="bg-green-600">
          Credited
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function ReferralsPage() {
  const [codeResult, referralsResult] = await Promise.all([
    getOrCreateReferralCode(),
    getPatientReferrals(),
  ]);

  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const origin = `${protocol}://${host}`;

  const referralLink = codeResult.code
    ? `${origin}/register?ref=${codeResult.code}`
    : "";

  const { referrals, stats } = referralsResult;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Referrals</h1>

      {/* Referral Code Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            Your Referral Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Share your referral link with friends and family. When they sign up
            and book their first appointment, you both earn credits!
          </p>

          {codeResult.error ? (
            <p className="text-sm text-destructive">{codeResult.error}</p>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                <code className="flex-1 text-sm font-mono font-semibold">
                  {codeResult.code}
                </code>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <p className="flex-1 truncate text-sm text-muted-foreground">
                  {referralLink}
                </p>
                <CopyReferralLink link={referralLink} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Referrals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <UserPlus className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.signedUp}</p>
              <p className="text-xs text-muted-foreground">Signed Up</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <CalendarCheck className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.booked}</p>
              <p className="text-xs text-muted-foreground">Booked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
              <Coins className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {(stats.totalCredits / 100).toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">Credits Earned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Referral History</CardTitle>
        </CardHeader>
        <CardContent>
          {referrals.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Gift className="h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-medium">No referrals yet</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Share your referral link with friends to start earning credits.
                You&apos;ll see your referral activity here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      Email
                    </th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      Status
                    </th>
                    <th className="pb-2 pr-4 font-medium text-muted-foreground">
                      Credits
                    </th>
                    <th className="pb-2 font-medium text-muted-foreground">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {referrals.map(
                    (referral: {
                      id: string;
                      referred_email: string | null;
                      status: string;
                      credit_amount_cents: number;
                      currency: string;
                      created_at: string;
                    }) => (
                      <tr key={referral.id}>
                        <td className="py-3 pr-4">
                          {referral.referred_email || "--"}
                        </td>
                        <td className="py-3 pr-4">
                          {statusBadge(referral.status)}
                        </td>
                        <td className="py-3 pr-4">
                          {referral.credit_amount_cents > 0
                            ? `${(referral.credit_amount_cents / 100).toFixed(2)} ${referral.currency}`
                            : "--"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
