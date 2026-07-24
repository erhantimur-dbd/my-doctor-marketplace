"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  ArrowRight,
  X,
  Stethoscope,
  Zap,
  BarChart3,
  Building2,
  Crown,
  type LucideIcon,
} from "lucide-react";
import {
  LICENSE_TIERS,
  AVAILABLE_MODULES,
  PLATFORM_BOOKING_FEE_PERCENT,
  formatPriceForLocale,
  formatAnnualEffectiveMonthlyForLocale,
  type LicenseTierConfig,
} from "@/lib/constants/license-tiers";
import {
  annualDiscountPercent,
  annualTotalPence,
  type BillingPeriod,
} from "@/lib/constants/billing-period";
import { ClinicGetStartedButton } from "@/components/shared/clinic-get-started-button";
import { cn } from "@/lib/utils";

/** Kept inside the client component — functions cannot be passed from Server Components. */
function getTierIcon(tierId: string): LucideIcon {
  switch (tierId) {
    case "free":
      return Stethoscope;
    case "starter":
      return Zap;
    case "professional":
      return BarChart3;
    case "clinic":
      return Building2;
    case "enterprise":
      return Crown;
    default:
      return Stethoscope;
  }
}

function getTierColor(tierId: string) {
  switch (tierId) {
    case "starter":
      return {
        bg: "bg-teal-50 dark:bg-teal-950/30",
        text: "text-teal-600",
      };
    case "professional":
      return {
        bg: "bg-violet-50 dark:bg-violet-950/30",
        text: "text-violet-600",
      };
    case "clinic":
      return {
        bg: "bg-blue-50 dark:bg-blue-950/30",
        text: "text-blue-600",
      };
    case "enterprise":
      return {
        bg: "bg-amber-50 dark:bg-amber-950/30",
        text: "text-amber-600",
      };
    default:
      return {
        bg: "bg-emerald-50 dark:bg-emerald-950/30",
        text: "text-emerald-600",
      };
  }
}

interface PricingBillingToggleProps {
  locale: string;
}

export function PricingBillingToggle({ locale }: PricingBillingToggleProps) {
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

  /** Unit always on its own line so amount baselines match across cards. */
  const unitLabel = (perUser: boolean) =>
    perUser ? "per user / mo" : "per mo";

  /** Keep feature bullets aligned with monthly vs annual display. */
  function formatFeatureLine(feature: string): string {
    const testingMo =
      AVAILABLE_MODULES.find((m) => m.key === "medical_testing")
        ?.priceMonthlyPence ?? 4900;
    if (period === "annual") {
      const eff = formatAnnualEffectiveMonthlyForLocale(testingMo, locale);
      const yearly = formatPriceForLocale(annualTotalPence(testingMo), locale);
      return feature
        .replace(/\+£49\/mo/gi, `+${eff}/mo`)
        .replace(/\+£49\/month/gi, `+${eff}/mo`)
        .replace(
          /\(optional \+£49\/mo add-on\)/gi,
          `(optional +${eff}/mo, ${yearly}/yr)`
        );
    }
    return feature;
  }

  /**
   * Fixed 3-line price stack for every card:
   *   1. Amount (or Custom / £0)
   *   2. Unit line (always present, same height)
   *   3. Billing detail (always present, same height)
   * Prevents wrap of "/ user / mo" under the figure in narrow 5-col layout.
   */
  function priceBlock(tier: LicenseTierConfig) {
    let amount: ReactNode;
    let unit: string;
    let detail: ReactNode;

    if (tier.isCustomPricing) {
      amount = "Custom";
      unit = "per org";
      detail = "Contact us for a quote";
    } else if (tier.isFreeTier) {
      // Same formatter + 3-line skeleton as paid so £0 shares the amount baseline
      amount = formatPriceForLocale(0, locale);
      unit = "per mo";
      detail = "Free forever";
    } else if (period === "annual") {
      const list = tier.priceMonthlyPence;
      const yearly = annualTotalPence(list);
      amount = formatAnnualEffectiveMonthlyForLocale(list, locale);
      unit = unitLabel(!!tier.perUser);
      detail = (
        <>
          <span className="font-medium text-foreground">
            {formatPriceForLocale(yearly, locale)}
            {tier.perUser ? "/user" : ""}
            /yr
          </span>
          <span className="mx-1 text-muted-foreground/80">·</span>
          <span className="font-medium text-emerald-600">2 mo free</span>
        </>
      );
    } else {
      amount = formatPriceForLocale(tier.priceMonthlyPence, locale);
      unit = unitLabel(!!tier.perUser);
      detail = "Billed monthly";
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5">
        {/* Line 1 — fixed height so Free £0 and paid amounts share one baseline */}
        <p className="flex h-9 w-full items-end justify-center text-center text-3xl font-bold leading-none tracking-tight tabular-nums xl:text-[1.75rem]">
          {amount}
        </p>
        {/* Line 2 — unit (always visible) */}
        <p className="h-5 w-full text-center text-xs leading-5 text-muted-foreground">
          {unit}
        </p>
        {/* Line 3 — billing / savings */}
        <p className="mt-0.5 flex h-8 w-full items-start justify-center px-1 text-center text-[11px] leading-snug text-muted-foreground">
          {detail}
        </p>
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
        {period === "annual" ? (
          <p className="text-center text-sm text-muted-foreground">
            12-month term · pay for 10 months, get 12 — save {discount}% vs
            monthly
          </p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            Month-to-month pricing · no lock-in · cancel anytime
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
              className={cn(
                "relative flex flex-col overflow-hidden border",
                isPopular && "border-foreground/20 shadow-lg",
                isFree && "border-emerald-400/90 shadow-sm",
                !isPopular && !isFree && "border-border"
              )}
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

              {/* Fixed header so price zone Y is identical on every card */}
              <div className="flex h-[148px] shrink-0 flex-col items-center px-5 pt-10 text-center sm:px-6">
                <div
                  className={`mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tierColor.bg}`}
                >
                  <TierIcon className={`h-5 w-5 ${tierColor.text}`} />
                </div>
                <h3 className="line-clamp-2 h-12 w-full text-lg font-bold leading-tight">
                  {tier.name}
                </h3>
                <p className="mt-1 line-clamp-2 h-10 w-full text-sm leading-snug text-muted-foreground">
                  {tier.description}
                </p>
              </div>

              <div className="flex h-[104px] shrink-0 flex-col items-center justify-center px-3 text-center sm:px-4">
                {priceBlock(tier)}
              </div>

              {/* Always two meta lines so Free/Enterprise match paid height */}
              <div className="flex h-[48px] shrink-0 flex-col items-center justify-center gap-0.5 px-3 text-center sm:px-4">
                {isEnterprise ? (
                  <>
                    <p className="text-xs leading-snug text-muted-foreground">
                      Tailored to your needs
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      Custom seats &amp; SLA
                    </p>
                  </>
                ) : isFree ? (
                  <>
                    <p className="text-xs leading-snug text-muted-foreground">
                      No card required · no commitment
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      1 user
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {period === "annual"
                        ? "12-month term · billed yearly"
                        : "Month-to-month · no lock-in"}
                    </p>
                    <p className="text-xs leading-snug text-muted-foreground">
                      {tier.perUser
                        ? `${tier.defaultSeats}–${tier.maxSeats} users`
                        : tier.includedSeats > 1
                          ? `${tier.includedSeats}–${tier.maxSeats} users`
                          : `${tier.defaultSeats} user`}
                      {tier.extraSeatPricePence > 0 && !tier.perUser && (
                        <>
                          {" · "}
                          {period === "annual"
                            ? formatAnnualEffectiveMonthlyForLocale(
                                tier.extraSeatPricePence,
                                locale
                              )
                            : formatPriceForLocale(
                                tier.extraSeatPricePence,
                                locale
                              )}
                          /extra seat
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
                      {formatFeatureLine(feature)}
                    </li>
                  ))}
                  {(tier.excludedFeatures ?? []).map((feature) => (
                    <li
                      key={`ex-${feature}`}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <X className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
                      {formatFeatureLine(feature)}
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
        on each booking (invoiced monthly). Annual licences are charged as 10×
        the monthly price once a year (2 months free). Seats: Starter &amp;
        Professional = 1 doctor · Clinic = 3 included (to 15).
      </p>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Founding Free is a permanent gateway (list &amp; prepare). Bookings,
        video and AI start on Starter. SMS/WhatsApp, analytics, CRM and waitlist
        are Professional+ (solo). Multi-doctor seats, multi-location, team tools
        and included medical testing are Clinic+. Custom branding &amp; API are
        Enterprise.
      </p>
    </div>
  );
}
