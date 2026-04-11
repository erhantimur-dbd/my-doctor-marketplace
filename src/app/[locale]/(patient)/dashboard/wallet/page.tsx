import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAllWalletBalances, getWalletTransactions } from "@/lib/wallet";
import { getPointsBalance, getPointsTransactions } from "@/lib/points";
import { getTierForPoints, getNextTier, getEffectiveRate, POINTS_REDEMPTION_RATE } from "@/lib/constants/loyalty-points";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Info, Trophy, Gift, Star, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatCurrency } from "@/lib/utils/currency";
import { WalletActions } from "./wallet-actions";

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const [balances, transactions] = await Promise.all([
    getAllWalletBalances(user.id),
    getWalletTransactions(user.id, 50),
  ]);

  // Get points balance for loyalty tier
  const pointsBalance = await getPointsBalance(user.id);
  const pointsTransactions = await getPointsTransactions(user.id, 20);
  const currentTier = getTierForPoints(pointsBalance.lifetime_points);
  const nextTier = getNextTier(pointsBalance.lifetime_points);
  const effectiveRate = getEffectiveRate(pointsBalance.lifetime_points);

  const totalBalances = balances.filter((b) => b.balance_cents > 0);

  const sourceLabels: Record<string, string> = {
    refund: "Booking Refund",
    cancel_rebook: "Cancel & Rebook",
    referral: "Referral Reward",
    promotion: "Promotion",
    admin_manual: "Account Credit",
    top_up: "Wallet Top-Up",
    gift_card: "Gift Card",
    loyalty: "Loyalty Cashback",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {/* Balance + Loyalty Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {totalBalances.length > 0 ? (
          totalBalances.map((b) => (
            <Card key={b.currency}>
              <CardContent className="flex items-center gap-4 p-6">
                <div className="rounded-full bg-green-50 p-3">
                  <Wallet className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Balance ({b.currency})</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(b.balance_cents, b.currency)}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="rounded-full bg-gray-50 p-3">
                <Wallet className="h-6 w-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Balance</p>
                <p className="text-2xl font-bold text-gray-400">—</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Loyalty Points Card */}
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`rounded-full p-3 ${currentTier.bgColor}`}>
              <Trophy className={`h-6 w-6 ${currentTier.color}`} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loyalty Points</p>
              <p className="text-2xl font-bold">{pointsBalance.available_points.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">
                {currentTier.icon} {currentTier.name} · {effectiveRate} pts/£1
                {nextTier && ` · ${(nextTier.minPoints - pointsBalance.lifetime_points).toLocaleString()} pts to ${nextTier.name}`}
              </p>
              <Link
                href="/rewards"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Learn more <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top-Up + Gift Card Actions */}
      <WalletActions />

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">How wallet credits work</p>
          <p className="mt-1">
            Wallet credits are automatically applied to your next booking, invoice, or care plan payment.
            You earn credits from: cancellation refunds (instant), loyalty points (redeemable at {POINTS_REDEMPTION_RATE} pts = £1), referral rewards, and gift cards.
          </p>
        </div>
      </div>

      {/* Points History */}
      {pointsTransactions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Points History
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Points</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pointsTransactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">
                      {new Date(txn.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {txn.type === "earn" ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <ArrowUpCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Earned</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-blue-600">
                          <ArrowDownCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Redeemed</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {txn.description || "—"}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${txn.type === "earn" ? "text-green-600" : "text-blue-600"}`}>
                      {txn.type === "earn" ? "+" : "-"}{txn.points.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {txn.balance_after.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {transactions.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No transactions yet
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="text-sm">
                      {new Date(txn.created_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {txn.type === "credit" ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <ArrowUpCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Credit</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <ArrowDownCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Debit</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {sourceLabels[txn.source_type] || txn.source_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                      {txn.description || "—"}
                    </TableCell>
                    <TableCell className={`text-right text-sm font-medium ${txn.type === "credit" ? "text-green-600" : "text-red-600"}`}>
                      {txn.type === "credit" ? "+" : "-"}{formatCurrency(txn.amount_cents, txn.currency)}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {formatCurrency(txn.balance_after_cents, txn.currency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
