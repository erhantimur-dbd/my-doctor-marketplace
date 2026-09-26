import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOfferAdmin } from "@/lib/offers/require-offer-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PriceForm } from "./price-form";
import { formatGbpFromPence } from "@/lib/offers/money";
import { PLAN_LABEL, type AnnualPlanId } from "@/lib/offers/plans";

export const metadata = { robots: { index: false, follow: false } };

export default async function OfferPricesPage() {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) redirect("/en/admin");

  const admin = createAdminClient();
  const { data: versions } = await admin
    .from("plan_price_versions")
    .select("plan_id, amount_pence, stripe_price_id, created_at")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/subscription-offers" className="text-sm text-muted-foreground">
          Back to offers
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Annual prices</h1>
        <p className="text-sm text-muted-foreground">
          Monthly prices are not changed here. Stripe test mode only.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Catalogue</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {(versions || []).length === 0 ? (
            <p className="text-muted-foreground">No catalogue rows yet. The seed script or a price change adds them.</p>
          ) : (
            (versions || []).map((row) => (
              <p key={row.stripe_price_id}>
                {PLAN_LABEL[row.plan_id as AnnualPlanId] || row.plan_id}{" "}
                {formatGbpFromPence(row.amount_pence)}{" "}
                <span className="text-muted-foreground">{row.stripe_price_id}</span>
              </p>
            ))
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Change price</CardTitle>
        </CardHeader>
        <CardContent>
          <PriceForm />
        </CardContent>
      </Card>
    </div>
  );
}
