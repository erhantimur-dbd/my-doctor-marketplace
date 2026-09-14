"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { connectStripeAccount } from "@/actions/doctor";
import { CreditCard, Loader2 } from "lucide-react";

export function ConnectStripeButton({
  label = "Connect Stripe Account",
  variant = "default",
  size = "sm",
}: {
  label?: string;
  variant?: "default" | "outline" | "secondary";
  size?: "default" | "sm" | "lg";
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError("");
    startTransition(async () => {
      const result = await connectStripeAccount();
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.url) {
        window.location.href = result.url;
        return;
      }
      setError("Could not start Stripe onboarding. Please try again.");
    });
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        variant={variant}
        onClick={handleClick}
        disabled={isPending}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <CreditCard className="mr-2 h-4 w-4" />
        )}
        {label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
