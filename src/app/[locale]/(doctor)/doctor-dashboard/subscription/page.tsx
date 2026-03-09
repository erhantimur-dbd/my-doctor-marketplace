"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Crown,
  Check,
  Loader2,
  AlertCircle,
  Calendar,
  Zap,
  ArrowUp,
  ArrowDown,
  Tag,
  X,
  FlaskConical,
  ArrowRight,
  Info,
} from "lucide-react";
import {
  LICENSE_TIERS,
  AVAILABLE_MODULES,
  getLicenseTier,
  formatPriceForLocale,
  formatPrice,
  type LicenseTierConfig,
} from "@/lib/constants/license-tiers";
import { Link } from "@/i18n/navigation";

interface Subscription {
  id: string;
  doctor_id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_subscription_id: string | null;
  created_at: string;
}

/** Map legacy plan IDs to display names (for existing subscriptions). */
function getLegacyPlanName(planId: string): string {
  // Try new tier system first
  const tier = getLicenseTier(planId);
  if (tier) return tier.name;
  // Legacy mappings
  const legacyNames: Record<string, string> = {
    basic: "Basic",
    professional: "Professional",
    premium: "Premium",
    clinic: "Clinic",
    testing_standalone: "Medical Testing",
  };
  return legacyNames[planId] || planId;
}

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SubscriptionPage() {
  const locale = useLocale();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponValidation, setCouponValidation] = useState<{
    valid: boolean;
    error?: string;
    couponId?: string;
    discount_type?: "percentage" | "fixed_amount";
    discount_value?: number;
    currency?: string;
    name?: string;
  } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [hasTestingAddon, setHasTestingAddon] = useState(false);
  const [hasOrgLicense, setHasOrgLicense] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const supabase = createSupabase();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: doctor } = await supabase
        .from("doctors")
        .select("id, has_testing_addon")
        .eq("profile_id", user.id)
        .single();
      if (!doctor) { setLoading(false); return; }

      setDoctorId(doctor.id);
      setHasTestingAddon(doctor.has_testing_addon ?? false);

      // Check for org-based license
      const { data: membership } = await supabase
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .single();

      if (membership) {
        const { data: license } = await supabase
          .from("licenses")
          .select("id")
          .eq("organization_id", membership.organization_id)
          .in("status", ["active", "trialing", "past_due"])
          .limit(1)
          .maybeSingle();

        setHasOrgLicense(!!license);
      }

      // Legacy per-doctor subscription
      const { data: sub } = await supabase
        .from("doctor_subscriptions")
        .select("*")
        .eq("doctor_id", doctor.id)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setSubscription(sub as Subscription | null);
    } catch (err) {
      console.error("Failed to load subscription data:", err);
    }
    setLoading(false);
  }

  async function handleSelectPlan(tierId: string) {
    if (!doctorId) return;
    setActionLoading(true);

    const supabase = createSupabase();

    if (subscription) {
      const { error } = await supabase
        .from("doctor_subscriptions")
        .update({
          plan_id: tierId,
          cancel_at_period_end: false,
        })
        .eq("id", subscription.id);

      if (error) {
        console.error("Subscription update failed:", error);
        alert("Failed to update subscription. Please try again.");
      }
    } else {
      const now = new Date();
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const { error } = await supabase.from("doctor_subscriptions").insert({
        doctor_id: doctorId,
        plan_id: tierId,
        status: "trialing",
        stripe_subscription_id: null,
        stripe_customer_id: null,
        current_period_start: now.toISOString(),
        current_period_end: trialEnd.toISOString(),
        cancel_at_period_end: false,
      });

      if (error) {
        console.error("Subscription creation failed:", error);
        alert("Failed to start trial. Please try again.");
      }
    }

    await loadData();
    setActionLoading(false);
  }

  async function handleCancelSubscription() {
    if (!subscription) return;
    setActionLoading(true);

    const supabase = createSupabase();
    const { error } = await supabase
      .from("doctor_subscriptions")
      .update({ cancel_at_period_end: true })
      .eq("id", subscription.id);

    if (error) {
      console.error("Cancel failed:", error);
      alert("Failed to cancel subscription. Please try again.");
    }

    setCancelDialogOpen(false);
    await loadData();
    setActionLoading(false);
  }

  async function handleToggleTestingAddon() {
    if (!doctorId) return;
    setActionLoading(true);
    const supabase = createSupabase();
    const { error } = await supabase
      .from("doctors")
      .update({ has_testing_addon: !hasTestingAddon })
      .eq("id", doctorId);
    if (error) {
      console.error("Addon toggle failed:", error);
      alert("Failed to update add-on. Please try again.");
    }
    await loadData();
    setActionLoading(false);
  }

  async function handleValidateCoupon() {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponValidation(null);
    try {
      const { validateCoupon } = await import("@/actions/coupon");
      const result = await validateCoupon(couponCode, "professional");
      setCouponValidation(result as any);
    } catch {
      setCouponValidation({ valid: false, error: "Failed to validate coupon" });
    }
    setValidatingCoupon(false);
  }

  function clearCoupon() {
    setCouponCode("");
    setCouponValidation(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Display tiers for plan selection (exclude free and enterprise)
  const displayTiers = LICENSE_TIERS.filter(
    (t) => !t.isFreeTier && !t.isCustomPricing
  );

  const currentPlanId = subscription?.plan_id || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and billing
        </p>
      </div>

      {/* Banner: org-based billing */}
      {hasOrgLicense && (
        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-blue-100 p-3 dark:bg-blue-900/50">
              <Info className="h-5 w-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-blue-900 dark:text-blue-100">
                Your subscription is managed through your organization
              </p>
              <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                Billing, plan upgrades, and seat management are handled on the
                organization billing page.
              </p>
              <Link href="/doctor-dashboard/organization/billing">
                <Button size="sm" className="mt-3" variant="default">
                  Go to Organization Billing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Subscription Status */}
      {subscription ? (
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold">
                    {getLegacyPlanName(subscription.plan_id)} Plan
                  </p>
                  <Badge
                    variant={
                      subscription.status === "active"
                        ? "default"
                        : subscription.status === "trialing"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {subscription.status === "trialing"
                      ? "Free Trial"
                      : subscription.status === "active"
                        ? "Active"
                        : "Past Due"}
                  </Badge>
                  {subscription.cancel_at_period_end && (
                    <Badge variant="destructive">Cancels at period end</Badge>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {subscription.status === "trialing" ? "Trial ends" : "Next billing date"}:{" "}
                  {new Date(
                    subscription.current_period_end
                  ).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
            {!subscription.cancel_at_period_end && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCancelDialogOpen(true)}
              >
                Cancel Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Zap className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold">No Active Subscription</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a plan below to unlock bookings, reminders, video
                consultations, and more.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Code Input */}
      {!subscription && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Have a coupon code?</p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => {
                  setCouponCode(e.target.value.toUpperCase());
                  if (couponValidation) setCouponValidation(null);
                }}
                className="max-w-xs font-mono"
              />
              {couponValidation?.valid ? (
                <Button variant="outline" size="sm" onClick={clearCoupon}>
                  <X className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={handleValidateCoupon}
                  disabled={validatingCoupon || !couponCode.trim()}
                >
                  {validatingCoupon ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              )}
            </div>
            {couponValidation?.valid && (
              <div className="mt-2 flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>
                  {couponValidation.name} &mdash;{" "}
                  {couponValidation.discount_type === "percentage"
                    ? `${couponValidation.discount_value}% off`
                    : `${formatPrice(couponValidation.discount_value! * 100, couponValidation.currency || "GBP")} off`}
                </span>
              </div>
            )}
            {couponValidation && !couponValidation.valid && (
              <p className="mt-2 text-sm text-red-500">{couponValidation.error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {displayTiers.map((tier) => {
          const isCurrent = currentPlanId === tier.id;
          const currentTierIndex = currentPlanId
            ? displayTiers.findIndex((t) => t.id === currentPlanId)
            : -1;
          const thisTierIndex = displayTiers.findIndex((t) => t.id === tier.id);
          const isUpgrade = currentTierIndex >= 0 && thisTierIndex > currentTierIndex;
          const isDowngrade = currentTierIndex >= 0 && thisTierIndex < currentTierIndex;

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/20"
                  : tier.popular
                    ? "border-primary/50"
                    : ""
              }`}
            >
              {tier.popular && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary px-3">Most Popular</Badge>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-green-600 px-3">Current Plan</Badge>
                </div>
              )}
              <CardHeader className="pt-8">
                <CardTitle>{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    {formatPriceForLocale(tier.priceMonthlyPence, locale)}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}/ {tier.perUser ? "user / " : ""}month
                  </span>
                </div>
                <ul className="space-y-2">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                {isCurrent ? (
                  <Button className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(tier.id)}
                    disabled={actionLoading}
                  >
                    {actionLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isUpgrade ? (
                      <ArrowUp className="mr-2 h-4 w-4" />
                    ) : isDowngrade ? (
                      <ArrowDown className="mr-2 h-4 w-4" />
                    ) : (
                      <Zap className="mr-2 h-4 w-4" />
                    )}
                    {currentPlanId
                      ? isUpgrade
                        ? "Upgrade"
                        : "Downgrade"
                      : "Choose Plan"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Add-ons */}
      {(() => {
        const testingModule = AVAILABLE_MODULES.find(
          (m) => m.key === "medical_testing"
        );
        if (!testingModule) return null;
        const isEligible =
          currentPlanId === "professional" ||
          currentPlanId === "premium" ||
          currentPlanId === "clinic" ||
          currentPlanId === "starter";

        return (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Add-ons</h2>
              <p className="text-sm text-muted-foreground">
                Enhance your practice with additional services
              </p>
            </div>
            <Card
              className={`transition-colors ${
                hasTestingAddon
                  ? "border-teal-400 ring-2 ring-teal-200"
                  : ""
              }`}
            >
              <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="rounded-full bg-teal-50 p-3">
                    <FlaskConical className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{testingModule.name}</h3>
                      <Badge variant="secondary">Add-on</Badge>
                      {hasTestingAddon && (
                        <Badge className="bg-teal-600">Active</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {testingModule.description}. Blood testing, urine
                      analysis, ECG, MRI scans, and more.
                    </p>
                    {!isEligible && !hasTestingAddon && (
                      <p className="mt-2 text-xs text-amber-600">
                        Subscribe to a paid plan to add medical testing for{" "}
                        {formatPriceForLocale(testingModule.priceMonthlyPence, locale)}/month.
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:shrink-0">
                  <div className="text-right">
                    <span className="text-2xl font-bold">
                      {formatPriceForLocale(testingModule.priceMonthlyPence, locale)}
                    </span>
                    <span className="text-muted-foreground"> / mo</span>
                  </div>
                  <Button
                    variant={hasTestingAddon ? "outline" : "default"}
                    onClick={handleToggleTestingAddon}
                    disabled={actionLoading || (!isEligible && !hasTestingAddon)}
                    className={
                      hasTestingAddon
                        ? "border-red-200 text-red-600 hover:bg-red-50"
                        : "bg-teal-600 hover:bg-teal-700"
                    }
                  >
                    {actionLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {hasTestingAddon ? "Remove" : "Add to Plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Free Profile Note */}
      {!currentPlanId && (
        <p className="text-center text-sm text-muted-foreground">
          You&apos;re currently on the <span className="font-medium text-foreground">Free Profile</span> — your listing is live in our directory. Upgrade to unlock booking, reminders, analytics, and more.
        </p>
      )}

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">
                  Are you sure you want to cancel?
                </p>
                <p className="mt-1 text-yellow-700">
                  Your subscription will remain active until the end of your
                  current billing period on{" "}
                  <strong>
                    {subscription
                      ? new Date(
                          subscription.current_period_end
                        ).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })
                      : "N/A"}
                  </strong>
                  . After that, your account will be downgraded and some features
                  will become unavailable.
                </p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Keep Subscription</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={actionLoading}
            >
              {actionLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
