"use client";

import { useState } from "react";
import { Video, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mintConsultJoin } from "@/actions/consult-join";
import type { ConsultJoinSource } from "@/lib/video/join-source";

interface JoinConsultButtonProps {
  bookingId: string;
  source: ConsultJoinSource;
  guestSignature?: string | null;
  label?: string;
  disabled?: boolean;
  size?: "default" | "sm" | "lg";
  className?: string;
}

export function JoinConsultButton({
  bookingId,
  source,
  guestSignature,
  label = "Join video call",
  disabled = false,
  size = "default",
  className,
}: JoinConsultButtonProps) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (disabled || pending) return;
    setError(null);
    setPending(true);
    try {
      const result = await mintConsultJoin({
        bookingId,
        source,
        guestSignature,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.joinUrl, "_blank", "noopener,noreferrer");
    } catch {
      setError("The video room could not be opened. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        size={size}
        className={cn("gap-2", className)}
        disabled={disabled || pending}
        onClick={onClick}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Video className="h-4 w-4" />
        )}
        {label}
      </Button>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
