import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BookingLookupResult } from "@/components/booking/booking-lookup-result";
import { MANAGE_TOKEN_INVALID } from "@/lib/booking/manage-token";
import { previewManageLink } from "@/actions/find-booking";
import { ManageContinue } from "./manage-continue";

export const metadata: Metadata = {
  title: "Manage booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function ManageBookingLinkPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  const token = (await searchParams).token?.trim() || "";
  const preview = token
    ? await previewManageLink(token)
    : { ok: false as const, error: MANAGE_TOKEN_INVALID };

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Manage your booking</CardTitle>
            <CardDescription>
              This one-time link opens the page where you can cancel or
              reschedule.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {preview.ok ? (
              <BookingLookupResult booking={preview.booking}>
                <ManageContinue token={token} locale={locale} />
              </BookingLookupResult>
            ) : (
              <p className="text-sm text-destructive" role="alert">
                {preview.error}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
