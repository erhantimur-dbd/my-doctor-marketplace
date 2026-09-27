import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOfferAdmin } from "@/lib/offers/require-offer-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeactivateOfferButton, OfferBuilder } from "./offer-builder";
import { PLAN_LABEL, isAnnualPlanId } from "@/lib/offers/plans";

export const metadata = { robots: { index: false, follow: false } };

export default async function SubscriptionOffersPage() {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) redirect("/en/admin");

  const admin = createAdminClient();
  const { data: offers, error } = await admin
    .from("subscription_offers")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Subscription offers</h1>
          <p className="text-sm text-muted-foreground">
            Founder only. Stripe test mode. Clinic plans stay out. Prices are read from the catalogue, not typed into the offer.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/subscription-offers/invite">
            <Button variant="outline">Invite</Button>
          </Link>
          <Link href="/admin/subscription-offers/prices">
            <Button variant="outline">Prices</Button>
          </Link>
        </div>
      </div>

      {error ? (
        <Card>
          <CardContent className="p-6 text-sm">
            Offers table is not available yet. Apply migration <code>00114_subscription_offers.sql</code> before using this page.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Live and past offers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(offers || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No offers yet. Run <code>scripts/seed-subscription-offers.ts</code> for the three examples, or create one here.
              </p>
            ) : null}
            {(offers || []).map((offer) => (
              <div key={offer.id} className="flex items-start justify-between gap-4 border-b py-3">
                <div>
                  <p className="font-medium">{offer.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {offer.kind === "percent_first_year"
                      ? `${offer.percent_off}% off first year`
                      : `${offer.trial_days}-day trial`}
                    {" · "}
                    {(offer.eligible_plans || [])
                      .filter(isAnnualPlanId)
                      .map((plan: "starter_annual" | "professional_annual") => PLAN_LABEL[plan])
                      .join(", ")}
                    {" · redeem by "}
                    {new Date(offer.redeem_by).toLocaleString("en-GB", { timeZone: "Europe/London" })}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={offer.active ? "default" : "secondary"}>
                    {offer.active ? "Active" : "Off"}
                  </Badge>
                  {offer.active ? <DeactivateOfferButton offerId={offer.id} /> : null}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Create offer</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferBuilder />
        </CardContent>
      </Card>
    </div>
  );
}
