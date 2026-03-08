"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Ban, Loader2 } from "lucide-react";
import { cancelInvoice } from "@/actions/invoices";

export function CancelInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [loading, setLoading] = useState(false);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this invoice?")) return;
    setLoading(true);
    const result = await cancelInvoice(invoiceId);
    if (result.error) {
      alert(result.error);
    }
    setLoading(false);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCancel}
      disabled={loading}
      className="text-destructive hover:text-destructive"
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Ban className="h-4 w-4" />
      )}
      <span className="sr-only">Cancel invoice</span>
    </Button>
  );
}
