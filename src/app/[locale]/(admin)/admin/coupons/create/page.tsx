"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createCoupon } from "@/actions/admin";
import { Link } from "@/i18n/navigation";

const PLAN_OPTIONS = [
  { id: "professional", label: "Professional" },
  { id: "premium", label: "Premium" },
  { id: "clinic", label: "Clinic" },
];

export default function CreateCouponPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [allPlans, setAllPlans] = useState(true);
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [duration, setDuration] = useState<"once" | "repeating" | "forever">("once");
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [validFrom, setValidFrom] = useState(new Date().toISOString().split("T")[0]);
  const [expiresAt, setExpiresAt] = useState("");

  function togglePlan(planId: string) {
    setSelectedPlans((prev) =>
      prev.includes(planId) ? prev.filter((p) => p !== planId) : [...prev, planId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const result = await createCoupon({
      code,
      name,
      description: description || undefined,
      discount_type: discountType,
      discount_value: Number(discountValue),
      currency: discountType === "fixed_amount" ? currency : "EUR",
      applicable_plans: allPlans ? null : selectedPlans.length > 0 ? selectedPlans : null,
      duration,
      duration_in_months: duration === "repeating" ? Number(durationInMonths) : undefined,
      max_uses: maxUses ? Number(maxUses) : null,
      valid_from: new Date(validFrom).toISOString(),
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Coupon created successfully");
      router.push("/en/admin/coupons");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Link
        href="/admin/coupons"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Coupons
      </Link>

      <h1 className="text-2xl font-bold">Create Coupon</h1>

      <form onSubmit={handleSubmit}>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="code">Coupon Code</Label>
                <Input
                  id="code"
                  placeholder="e.g. WELCOME50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  required
                  className="font-mono"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Min 3 characters. Auto-uppercased.
                </p>
              </div>
              <div>
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Welcome Discount"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  placeholder="Internal note about this coupon"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Discount */}
          <Card>
            <CardHeader>
              <CardTitle>Discount</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Discount Type</Label>
                <Select
                  value={discountType}
                  onValueChange={(v) => setDiscountType(v as "percentage" | "fixed_amount")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed_amount">Fixed Amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="discount_value">
                  {discountType === "percentage" ? "Percentage (1-100)" : "Amount (in cents)"}
                </Label>
                <Input
                  id="discount_value"
                  type="number"
                  placeholder={discountType === "percentage" ? "e.g. 20" : "e.g. 2000"}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  required
                  min={1}
                  max={discountType === "percentage" ? 100 : undefined}
                />
                {discountType === "fixed_amount" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Enter amount in cents (e.g. 2000 = €20.00)
                  </p>
                )}
              </div>
              {discountType === "fixed_amount" && (
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="GBP">GBP</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="TRY">TRY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>Duration</Label>
                <Select
                  value={duration}
                  onValueChange={(v) => setDuration(v as "once" | "repeating" | "forever")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once (first invoice only)</SelectItem>
                    <SelectItem value="repeating">Repeating (X months)</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {duration === "repeating" && (
                <div>
                  <Label htmlFor="duration_months">Number of Months</Label>
                  <Input
                    id="duration_months"
                    type="number"
                    placeholder="e.g. 3"
                    value={durationInMonths}
                    onChange={(e) => setDurationInMonths(e.target.value)}
                    required
                    min={1}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Restrictions */}
          <Card>
            <CardHeader>
              <CardTitle>Restrictions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Applicable Plans</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="all_plans"
                      checked={allPlans}
                      onCheckedChange={(checked) => setAllPlans(checked === true)}
                    />
                    <Label htmlFor="all_plans" className="font-normal">
                      All paid plans
                    </Label>
                  </div>
                  {!allPlans &&
                    PLAN_OPTIONS.map((plan) => (
                      <div key={plan.id} className="flex items-center gap-2 pl-6">
                        <Checkbox
                          id={plan.id}
                          checked={selectedPlans.includes(plan.id)}
                          onCheckedChange={() => togglePlan(plan.id)}
                        />
                        <Label htmlFor={plan.id} className="font-normal">
                          {plan.label}
                        </Label>
                      </div>
                    ))}
                </div>
              </div>
              <div>
                <Label htmlFor="max_uses">Max Uses (optional)</Label>
                <Input
                  id="max_uses"
                  type="number"
                  placeholder="Leave empty for unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  min={1}
                />
              </div>
            </CardContent>
          </Card>

          {/* Validity */}
          <Card>
            <CardHeader>
              <CardTitle>Validity Period</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="valid_from">Valid From</Label>
                <Input
                  id="valid_from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="expires_at">Expires At (optional)</Label>
                <Input
                  id="expires_at"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Leave empty for no expiry.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 flex justify-end">
          <Button type="submit" disabled={loading} size="lg">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Coupon
          </Button>
        </div>
      </form>
    </div>
  );
}
