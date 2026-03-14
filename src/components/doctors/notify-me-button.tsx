"use client";

import { useState, useEffect, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  subscribeToAvailability,
  unsubscribeFromAvailability,
  getAvailabilityAlert,
} from "@/actions/availability-alerts";

interface NotifyMeButtonProps {
  doctorId: string;
}

export function NotifyMeButton({ doctorId }: NotifyMeButtonProps) {
  const [subscribed, setSubscribed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAvailabilityAlert(doctorId).then((result) => {
      setSubscribed(result.subscribed);
      setLoaded(true);
    });
  }, [doctorId]);

  function handleToggle() {
    startTransition(async () => {
      if (subscribed) {
        const result = await unsubscribeFromAvailability(doctorId);
        if (result.error) {
          toast.error(result.error);
        } else {
          setSubscribed(false);
          toast.success("You will no longer receive availability notifications.");
        }
      } else {
        const result = await subscribeToAvailability(doctorId);
        if (result.error) {
          toast.error(result.error);
        } else {
          setSubscribed(true);
          toast.success(
            "We'll notify you when this doctor has new availability!"
          );
        }
      }
    });
  }

  if (!loaded) return null;

  return (
    <Button
      variant={subscribed ? "outline" : "secondary"}
      onClick={handleToggle}
      disabled={isPending}
      className="w-full gap-2"
      size="sm"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : subscribed ? (
        <BellOff className="h-4 w-4" />
      ) : (
        <Bell className="h-4 w-4" />
      )}
      {subscribed ? "Subscribed — Tap to Unsubscribe" : "Notify Me When Available"}
    </Button>
  );
}
