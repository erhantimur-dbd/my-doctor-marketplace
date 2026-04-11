"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlotPicker } from "@/components/booking/slot-picker";
import {
  acceptTreatmentPlanFull,
  acceptTreatmentPlanPerVisit,
} from "@/actions/treatment-plan";
import { Loader2, CreditCard, Check, LogIn, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { Link } from "@/i18n/navigation";

interface TreatmentPlanClientProps {
  planId: string;
  planToken: string;
  paymentType: "pay_full" | "pay_per_visit";
  totalPrice: string;
  currency: string;
  doctorId: string;
  consultationType: string;
  durationMinutes: number;
  locale: string;
}

export function TreatmentPlanClient({
  planId,
  planToken,
  paymentType,
  totalPrice,
  currency,
  doctorId,
  consultationType,
  durationMinutes,
  locale,
}: TreatmentPlanClientProps) {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const handleSlotSelect = (
    date: string,
    startTime: string,
    endTime: string
  ) => {
    setSelectedSlot({ date, startTime, endTime });
  };

  // ── Pay Full: select first appointment slot, then create Stripe checkout ──
  const handlePayFull = () => {
    if (!selectedSlot) return;

    startTransition(async () => {
      const result = await acceptTreatmentPlanFull(
        planId,
        selectedSlot.date,
        selectedSlot.startTime,
        selectedSlot.endTime
      );

      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        router.push(result.url);
      }
    });
  };

  // ── Pay Per Visit: accept plan (no payment now) ──
  const handlePayPerVisit = () => {
    startTransition(async () => {
      const result = await acceptTreatmentPlanPerVisit(planId);

      if (result.error) {
        toast.error(result.error);
      } else if (result.success) {
        toast.success("Care plan accepted! You can now book sessions.");
        router.push(`/${locale}/treatment-plan/${planToken}/confirmed`);
      }
    });
  };

  // ── Not logged in ──
  if (!userLoading && !user) {
    const redirectUrl = `/${locale}/treatment-plan/${planToken}`;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <LogIn className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-lg font-semibold">Sign in to continue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to sign in to your account to accept this care
              plan.
            </p>
          </div>
          <Link href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}>
            <Button size="lg" className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign In to Accept
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  // ── Loading user ──
  if (userLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // ── Pay Full flow ──
  if (paymentType === "pay_full") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Accept & Pay
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            Pay the full amount upfront and book all sessions at your
            convenience. Select the date and time for your first session to
            get started.
          </p>

          {!showSlotPicker ? (
            <Button
              size="lg"
              className="w-full gap-2"
              onClick={() => setShowSlotPicker(true)}
            >
              <CalendarDays className="h-4 w-4" />
              Select First Session &amp; Pay {totalPrice}
            </Button>
          ) : (
            <>
              <SlotPicker
                doctorId={doctorId}
                consultationType={consultationType}
                onSlotSelect={handleSlotSelect}
                slotDurationOverride={durationMinutes}
              />

              {selectedSlot && (
                <Button
                  size="lg"
                  className="w-full gap-2"
                  onClick={handlePayFull}
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay {totalPrice} &amp; Book First Session
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  // ── Pay Per Visit flow ──
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Check className="h-5 w-5" />
          Accept Care Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-muted-foreground">
          Accept this care plan to get started. You will pay for each
          session individually as you book them from your dashboard.
        </p>

        <Button
          size="lg"
          className="w-full gap-2"
          onClick={handlePayPerVisit}
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Accepting...
            </>
          ) : (
            <>
              <Check className="h-4 w-4" />
              Accept Care Plan
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
