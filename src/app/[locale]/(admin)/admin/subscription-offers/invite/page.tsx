import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOfferAdmin } from "@/lib/offers/require-offer-admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InviteForm } from "./invite-form";

export const metadata = { robots: { index: false, follow: false } };

export default async function OfferInvitePage() {
  const auth = await requireOfferAdmin();
  if (auth.error || !auth.user) redirect("/en/admin");

  const admin = createAdminClient();
  const { data: offers } = await admin
    .from("subscription_offers")
    .select("id, name, active, redeem_by")
    .eq("active", true)
    .gt("redeem_by", new Date().toISOString())
    .order("created_at", { ascending: false });

  const live = offers || [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/subscription-offers" className="text-sm text-muted-foreground">
          Back to offers
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Offer invite</h1>
        <p className="text-sm text-muted-foreground">
          Pick a specialty and one live offer, enter the doctor&apos;s email, and share the signup link in the meeting. Nothing is emailed from this page.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Signup link</CardTitle>
        </CardHeader>
        <CardContent>
          {live.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live offers. Create one first.</p>
          ) : (
            <InviteForm offers={live.map((offer) => ({ id: offer.id, name: offer.name }))} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
