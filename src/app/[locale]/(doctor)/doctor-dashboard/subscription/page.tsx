"use client";

import { useEffect, useState } from "react";
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
import {
  Crown,
  Check,
  Loader2,
  AlertCircle,
  Calendar,
  Zap,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { SUBSCRIPTION_PLANS } from "@/lib/constants/subscription-plans";
import { formatCurrency } from "@/lib/utils/currency";

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

function createSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function SubscriptionPage() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: doctor } = await supabase
      .from("doctors")
      .select("id")
      .eq("profile_id", user.id)
      .single();
    if (!doctor) return;

    setDoctorId(doctor.id);

    const { data: sub } = await supabase
      .from("doctor_subscriptions")
      .select("*")
      .eq("doctor_id", doctor.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    setSubscription(sub as Subscription | null);
    setLoading(false);
  }

  async function handleSelectPlan(planId: string) {
    if (!doctorId) return;
    setActionLoading(true);

    const supabase = createSupabase();

    if (subscription) {
      const { error } = await supabase
        .from("doctor_subscriptions")
        .update({
          plan_id: planId,
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
        plan_id: planId,
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

  function getPlanIndex(planId: string): number {
    return SUBSCRIPTION_PLANS.findIndex((p) => p.id === planId);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentPlanId = subscription?.plan_id || null;
  const currentPlanIndex = currentPlanId ? getPlanIndex(currentPlanId) : -1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription plan and billing
        </p>
      </div>

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
                    {SUBSCRIPTION_PLANS.find((p) => p.id === subscription.plan_id)
                      ?.name || "Unknown"}{" "}
                    Plan
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
                Start with a 14-day free trial. No credit card required. Choose a
                plan below to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div className="grid gap-6 lg:grid-cols-3">
        {SUBSCRIPTION_PLANS.map((plan, index) => {
          const isCurrent = currentPlanId === plan.id;
          const isPopular = "popular" in plan && plan.popular;
          const isUpgrade = currentPlanIndex >= 0 && index > currentPlanIndex;
          const isDowngrade = currentPlanIndex >= 0 && index < currentPlanIndex;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${
                isCurrent
                  ? "border-primary ring-2 ring-primary/20"
                  : isPopular
                    ? "border-primary/50"
                    : ""
              }`}
            >
              {isPopular && !isCurrent && (
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
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="mb-6">
                  <span className="text-3xl font-bold">
                    {formatCurrency(plan.priceMonthly, plan.currency)}
                  </span>
                  <span className="text-muted-foreground"> / month</span>
                </div>
                <ul className="space-y-2">
                  {plan.features.map((feature) => (
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
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleSelectPlan(plan.id)}
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
                      : "Start Free Trial"}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

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
