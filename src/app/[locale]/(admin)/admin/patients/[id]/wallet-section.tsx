"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Wallet } from "lucide-react";
import { toast } from "sonner";
import { adminCreditWallet } from "@/actions/admin";
import { formatCurrency } from "@/lib/utils/currency";
import { useRouter } from "@/i18n/navigation";

interface WalletBalance {
  balance_cents: number;
  currency: string;
}

interface WalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount_cents: number;
  currency: string;
  balance_after_cents: number;
  source_type: string;
  description: string | null;
  created_at: string;
}

interface WalletSectionProps {
  patientId: string;
  preferredCurrency?: string | null;
  balances: WalletBalance[];
  transactions: WalletTransaction[];
}

const CURRENCIES = ["GBP", "EUR", "USD", "TRY", "PLN"];

export function WalletSection({
  patientId,
  preferredCurrency,
  balances,
  transactions,
}: WalletSectionProps) {
  const router = useRouter();
  const [currency, setCurrency] = useState(
    preferredCurrency?.toUpperCase() || "GBP"
  );
  const [amountPounds, setAmountPounds] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCredit() {
    const pounds = parseFloat(amountPounds);
    if (!pounds || pounds <= 0) {
      toast.error("Enter a positive amount");
      return;
    }
    if (!description.trim()) {
      toast.error("Description is required for audit trail");
      return;
    }

    setSaving(true);
    const amountCents = Math.round(pounds * 100);
    const result = await adminCreditWallet(
      patientId,
      currency,
      amountCents,
      description.trim()
    );
    setSaving(false);

    if (result?.error) {
      toast.error(result.error);
      return;
    }

    toast.success(
      `Credited ${formatCurrency(amountCents, currency)}. New balance: ${formatCurrency(result.balance_cents || 0, currency)}`
    );
    setAmountPounds("");
    setDescription("");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Balances
          </p>
          {balances.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallet credit yet</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {balances.map((b) => (
                <div
                  key={b.currency}
                  className="rounded-lg border bg-muted/40 px-4 py-2"
                >
                  <p className="text-xs text-muted-foreground">{b.currency}</p>
                  <p className="text-lg font-semibold">
                    {formatCurrency(b.balance_cents, b.currency)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <p className="text-sm font-medium">Manual credit</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Amount ({currency})</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="25.00"
                value={amountPounds}
                onChange={(e) => setAmountPounds(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-1">
              <Label>Description</Label>
              <Input
                placeholder="e.g. Goodwill credit, promo"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>
          <Button onClick={handleCredit} disabled={saving}>
            {saving ? "Crediting..." : "Credit wallet"}
          </Button>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">
            Recent transactions
          </p>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions</p>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div>
                    <p className="font-medium">
                      {tx.type === "credit" ? "+" : "−"}
                      {formatCurrency(tx.amount_cents, tx.currency)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {tx.source_type.replace(/_/g, " ")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tx.description || "—"} ·{" "}
                      {new Date(tx.created_at).toLocaleString("en-GB")}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    bal {formatCurrency(tx.balance_after_cents, tx.currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
