import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAllWalletBalances, getWalletTransactions } from "@/lib/wallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Wallet, ArrowUpCircle, ArrowDownCircle, Info } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";

export default async function WalletPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const [balances, transactions] = await Promise.all([
    getAllWalletBalances(user.id),
    getWalletTransactions(user.id, 50),
  ]);

  const totalBalances = balances.filter((b) => b.balance_cents > 0);

  const sourceLabels: Record<string, string> = {
    refund: "Booking Refund",
    cancel_rebook: "Cancel & Rebook",
    referral: "Referral Reward",
    promotion: "Promotion",
    admin_manual: "Account Credit",
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Wallet</h1>

      {/* Balance Cards */}
      {totalBalances.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {totalBalances.map((b) => (
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
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Wallet className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p>No wallet balance yet.</p>
          </CardContent>
        </Card>
      )}

      {/* Info Banner */}
      <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
        <div className="text-sm text-blue-800">
          <p className="font-medium">How wallet credits work</p>
          <p className="mt-1">
            When you cancel a booking, you can choose to receive your refund as an instant wallet credit instead of waiting 3-5 days for a bank refund. Wallet credits are automatically applied to your next booking.
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
