"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SlotPicker } from "@/components/booking/slot-picker";
import { createInvitationCheckout } from "@/actions/follow-up";
import { Loader2, CreditCard, LogIn } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/hooks/use-user";
import { Link } from "@/i18n/navigation";

interface InvitationClientProps {
  invitationId: string;
  token: string;
  doctorId: string;
  consultationType: string;
  durationMinutes: number;
  locale: string;
}

export function InvitationClient({
  invitationId,
  token,
  doctorId,
  consultationType,
  durationMinutes,
  locale,
}: InvitationClientProps) {
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedSlot, setSelectedSlot] = useState<{
    date: string;
    startTime: string;
    endTime: string;
  } | null>(null);

  const handleSlotSelect = (date: string, startTime: string, endTime: string) => {
    setSelectedSlot({ date, startTime, endTime });
  };

  const handlePayAndBook = () => {
    if (!selectedSlot) return;

    startTransition(async () => {
      const result = await createInvitationCheckout(
        invitationId,
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

  // Not logged in
  if (!userLoading && !user) {
    const redirectUrl = `/${locale}/invitation/${token}`;
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <LogIn className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="font-semibold text-lg">Sign in to continue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              You need to sign in to your account to book and pay for your appointment.
            </p>
          </div>
          <Link href={`/login?redirect=${encodeURIComponent(redirectUrl)}`}>
            <Button size="lg" className="gap-2">
              <LogIn className="h-4 w-4" />
              Sign In to Book
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (userLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Select Your First Session</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
            onClick={handlePayAndBook}
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
                Pay & Book First Session
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
