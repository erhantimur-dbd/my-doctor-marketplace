"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Gift, Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { topUpWallet } from "@/actions/wallet";
import { redeemGiftCard } from "@/actions/wallet";
import { formatCurrency } from "@/lib/utils/currency";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const TOP_UP_PRESETS = [
  { cents: 2500, label: "£25" },
  { cents: 5000, label: "£50" },
  { cents: 10000, label: "£100" },
];

export function WalletActions() {
  const router = useRouter();

  // Top-up state
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [isTopUpPending, startTopUpTransition] = useTransition();

  // Gift card state
  const [giftCode, setGiftCode] = useState("");
  const [isRedeemPending, startRedeemTransition] = useTransition();
  const [redeemResult, setRedeemResult] = useState<{ success: boolean; amount?: string } | null>(null);

  const effectiveAmount = selectedAmount || (customAmount ? Math.round(parseFloat(customAmount) * 100) : 0);

  const handleTopUp = () => {
    if (!effectiveAmount || effectiveAmount < 500) {
      toast.error("Minimum top-up is £5");
      return;
    }

    startTopUpTransition(async () => {
      const result = await topUpWallet(effectiveAmount, "GBP");
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if (result.url) {
        window.location.href = result.url;
      }
    });
  };

  const handleRedeem = () => {
    if (!giftCode.trim()) {
      toast.error("Please enter a gift card code");
      return;
    }

    startRedeemTransition(async () => {
      const result = await redeemGiftCard(giftCode);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      if ("amountCents" in result && result.amountCents) {
        setRedeemResult({
          success: true,
          amount: formatCurrency(result.amountCents as number, result.currency as string),
        });
        setGiftCode("");
        router.refresh();
        setTimeout(() => setRedeemResult(null), 5000);
      }
    });
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {/* Top-Up Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Add Funds
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Pre-load your wallet to skip checkout on your next booking.
          </p>
          <Dialog open={topUpOpen} onOpenChange={setTopUpOpen}>
            <DialogTrigger asChild>
              <Button className="w-full">
                <CreditCard className="mr-2 h-4 w-4" />
                Top Up Wallet
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Top Up Wallet</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {TOP_UP_PRESETS.map((p) => (
                    <button
                      key={p.cents}
                      onClick={() => { setSelectedAmount(p.cents); setCustomAmount(""); }}
                      className={`rounded-lg border-2 p-3 text-center font-medium transition-colors ${
                        selectedAmount === p.cents
                          ? "border-primary bg-primary/5 text-primary"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div>
                  <Label className="text-sm">Or enter custom amount</Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                    <Input
                      type="number"
                      min="5"
                      max="500"
                      step="0.01"
                      value={customAmount}
                      onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(null); }}
                      placeholder="0.00"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleTopUp} disabled={!effectiveAmount || effectiveAmount < 500 || isTopUpPending}>
                  {isTopUpPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Pay {effectiveAmount ? formatCurrency(effectiveAmount, "GBP") : "—"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Gift Card Redemption */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4" />
            Redeem Gift Card
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            Enter a gift card code to add the balance to your wallet.
          </p>
          <div className="flex gap-2">
            <Input
              value={giftCode}
              onChange={(e) => setGiftCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX-XXXX"
              className="font-mono uppercase"
              maxLength={14}
            />
            <Button onClick={handleRedeem} disabled={!giftCode.trim() || isRedeemPending}>
              {isRedeemPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Redeem"
              )}
            </Button>
          </div>
          {redeemResult?.success && (
            <div className="mt-2 flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" />
              {redeemResult.amount} added to your wallet!
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
