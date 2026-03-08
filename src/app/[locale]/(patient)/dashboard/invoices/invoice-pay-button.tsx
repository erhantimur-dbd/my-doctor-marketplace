"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { CreditCard, Loader2 } from "lucide-react";
import { createInvoiceCheckout } from "@/actions/invoices";
import { toast } from "sonner";

export function InvoicePayButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  function handlePay() {
    startTransition(async () => {
      const result = await createInvoiceCheckout(invoiceId);
      if (result.error) {
        toast.error(result.error);
      } else if (result.url) {
        window.location.href = result.url;
      }
    });
  }

  return (
    <Button
      variant="default"
      size="sm"
      className="gap-1.5"
      onClick={handlePay}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <CreditCard className="h-3.5 w-3.5" />
      )}
      Pay
    </Button>
  );
}
