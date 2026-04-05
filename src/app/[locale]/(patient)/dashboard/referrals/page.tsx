import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Gift,
  Users,
  Star,
  Share2,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getOrCreateReferralCode } from "@/actions/patient";
import { ReferralShareClient } from "./referral-share-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Referrals | MyDoctors360",
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
        <Badge className="bg-green-600 hover:bg-green-700 text-white">
          Credited
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

export default async function ReferralsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch referral code, referrals, and points in parallel
  const [codeResult, referralsResponse, pointsResponse] = await Promise.all([
    getOrCreateReferralCode(),
    supabase
      .from("patient_referrals")
      .select("id, referred_email, status, credit_amount_cents, currency, created_at")
      .eq("referrer_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("points_transactions")
      .select("points")
      .eq("user_id", user.id)
      .eq("source", "referral"),
  ]);

  const referrals = referralsResponse.data ?? [];
  const pointsRows = pointsResponse.data ?? [];

  const totalReferrals = referrals.length;
  const completedBookings = referrals.filter(
    (r) => r.status === "booked" || r.status === "credited"
  ).length;
  const totalPoints = pointsRows.reduce((sum, row) => sum + (row.points ?? 0), 0);

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";
  const referralCode = codeResult.code ?? "";
  const referralLink = referralCode ? `${APP_URL}/register?ref=${referralCode}` : "";

  return (
    <div className="space-y-8">
      {/* Hero / Header */}
      <div className="text-center space-y-3 py-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Gift className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Invite Friends, Earn 1,000 Points
        </h1>
        <p className="mx-auto max-w-xl text-muted-foreground">
          Share your referral link with friends and family. When they sign up and
          complete their first appointment, you both earn 1,000 reward points!
        </p>
      </div>

      {/* Referral Link Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5" />
            Your Referral Link
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {codeResult.error ? (
            <p className="text-sm text-destructive">{codeResult.error}</p>
          ) : (
            <>
              <div className="rounded-lg border bg-muted/50 p-4">
                <p className="break-all font-mono text-sm font-semibold select-all">
                  {referralLink}
                </p>
              </div>
              <ReferralShareClient
                referralCode={referralCode}
                referralLink={referralLink}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalReferrals}</p>
              <p className="text-sm text-muted-foreground">Friends Referred</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{completedBookings}</p>
              <p className="text-sm text-muted-foreground">Completed Bookings</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <Star className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-3xl font-bold">{totalPoints.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Points Earned</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                1
              </div>
              <h3 className="font-semibold">Share Your Unique Link</h3>
              <p className="text-sm text-muted-foreground">
                Send your personal referral link to friends, family, or colleagues
                via any channel.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                2
              </div>
              <h3 className="font-semibold">Friend Signs Up &amp; Books</h3>
              <p className="text-sm text-muted-foreground">
                Your friend creates an account using your link and books their
                first doctor appointment.
              </p>
            </div>
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                3
              </div>
              <h3 className="font-semibold">You Both Earn 1,000 Points</h3>
              <p className="text-sm text-muted-foreground">
                Once the appointment is completed, both you and your friend
                receive 1,000 reward points.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Referral History */}
      {referrals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Referral History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Friend&apos;s Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {referrals.map(
                    (referral: {
                      id: string;
                      referred_email: string | null;
                      status: string;
                      credit_amount_cents: number;
                      currency: string;
                      created_at: string;
                    }) => (
                      <TableRow key={referral.id}>
                        <TableCell>
                          {referral.referred_email || "--"}
                        </TableCell>
                        <TableCell>{statusBadge(referral.status)}</TableCell>
                        <TableCell>
                          {referral.status === "credited" ? "1,000" : "--"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(referral.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
