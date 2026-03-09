"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  Check,
  Loader2,
  CreditCard,
  Zap,
  Users,
  Plus,
  ExternalLink,
  CheckCircle2,
  FlaskConical,
  Tag,
  X,
} from "lucide-react";
import { LICENSE_TIERS, AVAILABLE_MODULES, formatPrice } from "@/lib/constants/license-tiers";
import {
  getOrganizationLicense,
  createLicenseCheckout,
  manageLicenseBilling,
  addExtraSeats,
  toggleModule,
} from "@/actions/license";

export default function BillingPage() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [license, setLicense] = useState<any>(null);
  const [modules, setModules] = useState<any[]>([]);
  const [isPending, startTransition] = useTransition();
  const [extraSeats, setExtraSeats] = useState("1");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [couponCode, setCouponCode] = useState("");

  useEffect(() => {
    loadData();
    if (searchParams.get("success") === "true") {
      setSuccessMsg("Subscription activated! Thank you.");
      setTimeout(() => setSuccessMsg(""), 5000);
    }
  }, [searchParams]);

  async function loadData() {
    const result = await getOrganizationLicense();
    setLicense(result.license);
    setModules(result.modules || []);
    setLoading(false);
  }

  async function handleSubscribe(tier: string) {
    const formData = new FormData();
    formData.set("tier", tier);
    formData.set("billing_period", "monthly");
    if (couponCode.trim()) formData.set("coupon_code", couponCode);

    startTransition(async () => {
      const result = await createLicenseCheckout(formData);
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(""), 4000);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  async function handleManageBilling() {
    startTransition(async () => {
      const result = await manageLicenseBilling();
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(""), 4000);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  async function handleAddSeats() {
    const count = parseInt(extraSeats, 10);
    if (isNaN(count) || count < 1) return;
    const formData = new FormData();
    formData.set("count", String(count));
    startTransition(async () => {
      const result = await addExtraSeats(formData);
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(""), 4000);
      } else {
        await loadData();
        setSuccessMsg(`Added ${count} seat(s)`);
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    });
  }

  async function handleToggleModule(moduleKey: string, enabled: boolean) {
    const formData = new FormData();
    formData.set("module_key", moduleKey);
    formData.set("enabled", String(enabled));
    startTransition(async () => {
      const result = await toggleModule(formData);
      if (result.error) {
        setErrorMsg(result.error);
        setTimeout(() => setErrorMsg(""), 4000);
      } else {
        await loadData();
        setSuccessMsg(enabled ? "Module activated" : "Module deactivated");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currentTier = license?.tier || null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Billing & License</h1>
        <p className="text-muted-foreground">
          Manage your subscription, seats, and add-ons
        </p>
      </div>

      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </div>
      )}

      {/* Current License Status */}
      {license ? (
        <Card>
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Crown className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold capitalize">
                    {license.tier} License
                  </p>
                  <Badge
                    variant={
                      license.status === "active" || license.status === "trialing"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {license.status === "trialing" ? "Trial" : license.status}
                  </Badge>
                </div>
                <div className="mt-1 flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {license.used_seats}/{license.max_seats} seats
                  </span>
                  <span>
                    Period ends:{" "}
                    {new Date(license.current_period_end).toLocaleDateString(
                      "en-GB",
                      { day: "numeric", month: "short", year: "numeric" }
                    )}
                  </span>
                </div>
              </div>
            </div>
            <Button variant="outline" onClick={handleManageBilling} disabled={isPending}>
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="mr-2 h-4 w-4" />
              )}
              Manage Billing
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex items-start gap-4 p-6">
            <div className="rounded-full bg-yellow-50 p-3">
              <Zap className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="font-semibold">No Active License</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a plan below to activate your practice on the platform.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Extra Seats (only for existing license) */}
      {license && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add Extra Seats</CardTitle>
            <CardDescription>
              Need more seats beyond your plan? Each extra seat is €29/month.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3">
              <div>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={extraSeats}
                  onChange={(e) => setExtraSeats(e.target.value)}
                  className="w-24"
                />
              </div>
              <Button onClick={handleAddSeats} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Add Seats
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Coupon Code (only when no license) */}
      {!license && (
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">Have a coupon code?</p>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="max-w-xs font-mono"
              />
              {couponCode && (
                <Button variant="outline" size="sm" onClick={() => setCouponCode("")}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plan Cards */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">
          {license ? "Available Plans" : "Choose a Plan"}
        </h2>
        <div className="grid gap-6 lg:grid-cols-4">
          {LICENSE_TIERS.map((tier) => {
            const isCurrent = currentTier === tier.id;
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
                    <Badge className="bg-primary px-3">Popular</Badge>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-green-600 px-3">Current</Badge>
                  </div>
                )}
                <CardHeader className="pt-8">
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="mb-4">
                    {tier.isCustomPricing ? (
                      <span className="text-2xl font-bold">Custom</span>
                    ) : tier.isFreeTier ? (
                      <span className="text-2xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-2xl font-bold">
                          {formatPrice(tier.priceMonthlyPence, "GBP")}
                        </span>
                        <span className="text-muted-foreground">
                          {tier.perUser ? " / user / mo" : " / mo"}
                        </span>
                      </>
                    )}
                  </div>
                  <p className="mb-3 text-sm text-muted-foreground">
                    {tier.defaultSeats === tier.maxSeats
                      ? `${tier.defaultSeats} seat${tier.defaultSeats > 1 ? "s" : ""}`
                      : `${tier.defaultSeats}–${tier.maxSeats} seats`}
                  </p>
                  <ul className="space-y-1.5">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  {isCurrent ? (
                    <Button className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : tier.isCustomPricing ? (
                    <Button className="w-full" variant="outline" disabled>
                      Contact Sales
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      variant={tier.popular ? "default" : "outline"}
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={isPending}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Zap className="mr-2 h-4 w-4" />
                      )}
                      {license ? "Switch Plan" : "Subscribe"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add-on Modules */}
      {license && AVAILABLE_MODULES.length > 0 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Add-on Modules</h2>
            <p className="text-sm text-muted-foreground">
              Extend your practice with additional capabilities
            </p>
          </div>
          {AVAILABLE_MODULES.map((mod) => {
            const isActive = modules.some(
              (m: any) => m.module_key === mod.key && m.is_active
            );
            return (
              <Card
                key={mod.key}
                className={isActive ? "border-teal-400 ring-2 ring-teal-200" : ""}
              >
                <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-teal-50 p-3 dark:bg-teal-950">
                      <FlaskConical className="h-5 w-5 text-teal-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{mod.name}</h3>
                        {isActive && (
                          <Badge className="bg-teal-600">Active</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {mod.description}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 sm:shrink-0">
                    <div className="text-right">
                      <span className="text-xl font-bold">
                        {formatPrice(mod.priceMonthlyPence, "GBP")}
                      </span>
                      <span className="text-muted-foreground"> / mo</span>
                    </div>
                    <Button
                      variant={isActive ? "outline" : "default"}
                      onClick={() => handleToggleModule(mod.key, !isActive)}
                      disabled={isPending}
                      className={
                        isActive
                          ? "border-red-200 text-red-600 hover:bg-red-50"
                          : "bg-teal-600 hover:bg-teal-700"
                      }
                    >
                      {isPending && (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      )}
                      {isActive ? "Remove" : "Add"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
