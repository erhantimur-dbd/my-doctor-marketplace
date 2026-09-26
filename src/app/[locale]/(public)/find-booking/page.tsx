import type { Metadata } from "next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FindBookingForm } from "./find-booking-form";

export const metadata: Metadata = {
  title: "Find my booking",
  description:
    "Look up a booking with your booking number and the email you used.",
};

export default async function FindBookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Find my booking</CardTitle>
            <CardDescription>
              Enter your booking number and the email you booked with. Older
              numbers start with BK-. Newer numbers start with MD-.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FindBookingForm locale={locale} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
