"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { redeemManageLink } from "@/actions/find-booking";

export function ManageContinue({
  token,
  locale,
}: {
  token: string;
  locale: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        className="w-full"
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await redeemManageLink(token, locale);
            if (result?.error) setError(result.error);
          });
        }}
      >
        {pending ? "Opening…" : "Continue to manage this booking"}
      </Button>
      <p className="text-xs text-muted-foreground">
        This link works once. The next page is where you can cancel or
        reschedule. This screen cannot change the booking by itself.
      </p>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
