"use client";

import { useMemo, useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  ArrowRight,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  LICENSE_TIERS,
  PLATFORM_BOOKING_FEE_PERCENT,
  formatPriceForLocale,
  type LicenseTierConfig,
} from "@/lib/constants/license-tiers";
import {
  annualDiscountPercent,
  annualEffectiveMonthlyPence,
  annualTotalPence,
  type BillingPeriod,
} from "@/lib/constants/billing-period";
import { ClinicGetStartedButton } from "@/components/shared/clinic-get-started-button";
import { cn } from "@/lib/utils";

type TierVisual = {
  icon: LucideIcon;
  bg: string;
  text: string;
};

interface PricingBillingToggleProps {
  locale: string;
  getTierIcon: (tierId: string) => LucideIcon;
  getTierColor: (tierId: string) => { bg: string; text: string };
}

export function PricingBillingToggle({
  locale,
  getTierIcon,
  getTierColor,
}: PricingBillingToggleProps) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const discount = annualDiscountPercent();

  const displayTiers = useMemo(() => {
    const free = LICENSE_TIERS.find((t) => t.isFreeTier);
    const paid = LICENSE_TIERS.filter((t) => !t.isFreeTier);
    return free ? [free, ...paid] : paid;
  }, []);

  function registerHref(tier: LicenseTierConfig) {
    const params = new URLSearchParams({ tier: tier.id });
    if (!tier.isFreeTier && !tier.isCustomPricing) {
      params.set("billing", period);
    }
    return `/register-doctor?${params.toString()}`;
  }

  function priceBlock(tier: LicenseTierConfig) {
    if (tier.isCustomPricing) {
      return <span className="text-4xl font-bold">Custom</span>;
    }
    if (tier.isFreeTier) {
      return (
        <>
          <span className="text-4xl font-bold">£0</span>
          <span className="text-sm text-muted-foreground">
            forever · upgrade anytime
          </span>
        </>
      );
    }

    if (period === "annual") {
      const effective = annualEffectiveMonthlyPence(tier.priceMonthlyPence);
      const yearly = annualTotalPence(tier.priceMonthlyPence);
      return (
        <>
          <div>
            <span className="text-4xl font-bold">
              {formatPriceForLocale(effective, locale)}
            </span>
            <span className="text-muted-foreground">
              {tier.perUser ? " / user / mo" : " / mo"}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatPriceForLocale(yearly, locale)}
            {tier.perUser ? "/user" : ""} billed yearly
            <span className="ml-1 font-medium text-emerald-600">
              · 2 months free
            </span>
          </p>
        </>
      );
    }

    return (
      <div>
        <span className="text-4xl font-bold">
          {formatPriceForLocale(tier.priceMonthlyPence, locale)}
        </span>
        <span className="text-muted-foreground">
          {tier.perUser ? " / user / mo" : " / month"}
        </span>
      </div>
    );
  }

  return (
    <div>
      {/* Billing toggle */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="inline-flex items-center rounded-full border bg-muted/40 p-1">
          <button
            type="button"
            onClick={() => setPeriod("monthly")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              period === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setPeriod("annual")}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-colors",
              period === "annual"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Annual
            <Badge
              variant="secondary"
              className="ml-2 bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
            >
              2 months free
            </Badge>
          </button>
        </div>
        {period === "annual" && (
          <p className="text-center text-sm text-muted-foreground">
            Pay for 10 months, get 12 — save {discount}% vs monthly
          </p>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 lg:items-stretch">
        {displayTiers.map((tier) => {
          const TierIcon = getTierIcon(tier.id);
          const tierColor = getTierColor(tier.id);
          const isPopular = tier.popular;
          const isEnterprise = tier.isCustomPricing;
          const isFree = !!tier.isFreeTier;

          return (
            <Card
              key={tier.id}
              className={`relative flex flex-col overflow-hidden ${
                isPopular
                  ? "border-foreground/20 shadow-lg"
                  : isFree
                    ? "border-emerald-300/80 shadow-sm ring-1 ring-emerald-100 dark:ring-emerald-900/40"
                    : ""
              }`}
            >
              {isPopular && (
                <div className="absolute -top-0 left-1/2 z-10 -translate-x-1/2 translate-y-2">
                  <Badge className="bg-foreground text-background shadow-md hover:bg-foreground">
                    Most Popular
                  </Badge>
                </div>
              )}
              {isFree && (
                <div className="absolute -top-0 left-1/2 z-10 -translate-x-1/2 translate-y-2">
                  <Badge className="bg-emerald-600 text-white shadow-md hover:bg-emerald-600">
                    Start here
                  </Badge>
                </div>
              )}

              <div className="flex flex-col items-center px-6 pt-10 text-center">
                <div
                  className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${tierColor.bg}`}
                >
                  <TierIcon className={`h-5 w-5 ${tierColor.text}`} />
                </div>
                <h3 className="text-lg font-bold">{tier.name}</h3>
                <p className="mt-1 min-h-[40px] text-sm text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <div className="flex min-h-[96px] flex-col items-center justify-center px-6 text-center">
                {priceBlock(tier)}
              </div>

              <div className="flex h-[48px] flex-col items-center justify-center px-6 text-center">
                {isEnterprise ? (
                  <p className="text-xs text-muted-foreground">
                    Tailored to your needs
                  </p>
                ) : isFree ? (
                  <p className="text-xs text-muted-foreground">
                    No card required · no commitment
                  </p>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {period === "annual"
                        ? "Billed annually · 12-month term"
                        : tier.commitmentMonths > 0
                          ? "12-month commitment, billed monthly"
                          : "Billed monthly"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tier.perUser
                        ? `${tier.defaultSeats}–${tier.maxSeats} users`
                        : tier.includedSeats > 1
                          ? `${tier.includedSeats} users included, up to ${tier.maxSeats}`
                          : `${tier.defaultSeats} user`}
                      {tier.extraSeatPricePence > 0 && !tier.perUser && (
                        <>
                          {" · "}
                          {formatPriceForLocale(
                            period === "annual"
                              ? annualEffectiveMonthlyPence(
                                  tier.extraSeatPricePence
                                )
                              : tier.extraSeatPricePence,
                            locale
                          )}
                          /extra seat
                          {period === "annual" ? " eq." : ""}
                        </>
                      )}
                    </p>
                  </>
                )}
              </div>

              <div className="px-6 pb-6 pt-2">
                <Separator />
              </div>

              <CardContent className="flex flex-1 flex-col px-6 pb-6 pt-0">
                <ul className="flex-1 space-y-2.5">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2 text-sm"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {feature}
                    </li>
                  ))}
                  {(tier.excludedFeatures ?? []).map((feature) => (
                    <li
                      key={`ex-${feature}`}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="p-6 pt-0">
                {isEnterprise ? (
                  <Button
                    className="w-full rounded-full"
                    variant="outline"
                    asChild
                  >
                    <Link href="/support">
                      Get in Touch for a Demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                ) : tier.id === "clinic" ? (
                  <ClinicGetStartedButton
                    locale={locale}
                    tier={tier.id}
                    billing={period}
                  />
                ) : (
                  <Button
                    className="w-full rounded-full"
                    variant={isPopular || isFree ? "default" : "outline"}
                    asChild
                  >
                    <Link href={registerHref(tier)}>
                      {isFree ? "Start free" : "Get Started"}
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Paid plans include a {PLATFORM_BOOKING_FEE_PERCENT}% platform commission
        on each booking, invoiced monthly. Annual billing charges 10 months
        upfront (2 months free) for a 12-month term. Founding Free never
        charges a card — upgrade when you want online bookings and AI insights.
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Platform features (video, analytics, CRM) apply to paid plans. Free is
        a permanent gateway: list and prepare; take bookings on Starter+.
      </p>
    </div>
  );
}
