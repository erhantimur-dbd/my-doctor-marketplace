"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { adminResendPaymentLink } from "@/actions/admin";
import { useRouter } from "next/navigation";

interface ResendPaymentLinkButtonProps {
  bookingId: string;
  initialResendCount?: number;
}

export function ResendPaymentLinkButton({
  bookingId,
  initialResendCount = 0,
}: ResendPaymentLinkButtonProps) {
  const [loading, setLoading] = useState(false);
  const [resendCount, setResendCount] = useState(initialResendCount);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleResend = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    const result = await adminResendPaymentLink(bookingId);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if ("resendCount" in result) {
      setResendCount(result.resendCount as number);
    }
    setSuccess(true);
    router.refresh();

    // Clear success after 3s
    setTimeout(() => setSuccess(false), 3000);
  };

  const maxReached = resendCount >= 5;

  return (
    <div className="space-y-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleResend}
        disabled={loading || maxReached}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 h-4 w-4" />
        )}
        Resend Payment Link
        {resendCount > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">
            ({resendCount}/5)
          </span>
        )}
      </Button>

      {success && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <Mail className="h-3 w-3" />
          Payment link resent successfully!
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      {maxReached && (
        <p className="text-xs text-amber-600">
          Maximum resend limit reached.
        </p>
      )}
    </div>
  );
}
