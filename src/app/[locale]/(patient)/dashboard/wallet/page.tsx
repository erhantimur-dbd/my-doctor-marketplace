import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAllWalletBalances, getWalletTransactions } from "@/lib/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Info, Trophy, Gift, Star } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { WalletActions } from "./wallet-actions";

// Loyalty tiers (matching webhook logic)
const LOYALTY_TIERS = [
  { min: 15, percent: 5, name: "Gold", color: "text-yellow-600 bg-yellow-50", icon: "🥇" },
  { min: 5, percent: 3, name: "Silver", color: "text-gray-600 bg-gray-50", icon: "🥈" },
  { min: 0, percent: 2, name: "Bronze", color: "text-amber-700 bg-amber-50", icon: "🥉" },
];

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const [balances, transactions] = await Promise.all([
    getAllWalletBalances(user.id),
    getWalletTransactions(user.id, 50),
  ]);

  // Get completed booking count for loyalty tier
  const { count: completedBookings } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", user.id)
    .in("status", ["confirmed", "approved", "completed"]);

  const bookingCount = completedBookings || 0;
  const currentTier = LOYALTY_TIERS.find((t) => bookingCount >= t.min) || LOYALTY_TIERS[2];
  const nextTier = LOYALTY_TIERS.find((t) => t.min > bookingCount && t.min <= currentTier.min + 20);

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

        {/* Loyalty Tier Card */}
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className={`rounded-full p-3 ${currentTier.color}`}>
              <Trophy className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Loyalty Tier</p>
              <p className="text-lg font-bold">{currentTier.icon} {currentTier.name}</p>
              <p className="text-xs text-muted-foreground">
                {currentTier.percent}% cashback on bookings
                {nextTier && ` • ${nextTier.min - bookingCount} more to ${nextTier.name}`}
              </p>
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
            Wallet credits are automatically applied to your next booking, invoice, or treatment plan payment.
            You earn credits from: cancellation refunds (instant), loyalty cashback ({currentTier.percent}%), referral rewards, and gift cards.
          </p>
        </div>
      </div>

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
