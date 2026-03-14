"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Printer, XCircle, Loader2 } from "lucide-react";
import { cancelPrescription } from "@/actions/prescriptions";

interface PrescriptionActionsProps {
  prescriptionId: string;
  status: string;
}

export function PrescriptionActions({
  prescriptionId,
  status,
}: PrescriptionActionsProps) {
  const router = useRouter();
  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this prescription?")) return;
    setCancelling(true);
    const result = await cancelPrescription(prescriptionId);
    setCancelling(false);
    if (!result.error) {
      router.refresh();
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="mr-1 h-4 w-4" />
        Print
      </Button>
      {status === "active" && (
        <Button
          variant="destructive"
          size="sm"
          onClick={handleCancel}
          disabled={cancelling}
        >
          {cancelling ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <XCircle className="mr-1 h-4 w-4" />
          )}
          Cancel
        </Button>
      )}
    </div>
  );
}
