"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, XCircle } from "lucide-react";
import { adminCancelBooking, adminGetCancelPreview } from "@/actions/admin";
import { useRouter } from "next/navigation";

interface AdminCancelButtonProps {
  bookingId: string;
}

export function AdminCancelButton({ bookingId }: AdminCancelButtonProps) {
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{
    isUnpaid?: boolean;
    refundPercent?: number;
    refundAmountCents?: number;
    totalAmountCents?: number;
    currency?: string;
    policy?: string | null;
    hoursUntilAppointment?: number;
    message?: string;
  } | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) {
      setPreviewLoading(true);
      adminGetCancelPreview(bookingId).then((result) => {
        setPreviewLoading(false);
        if ("error" in result && result.error) {
          setError(result.error as string);
        } else {
          setPreview(result as typeof preview);
        }
      });
    }
  }, [open, bookingId]);

  const handleCancel = async () => {
    setLoading(true);
    setError(null);

    const result = await adminCancelBooking(bookingId, reason || undefined);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setOpen(false);
    router.refresh();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" className="w-full">
          <XCircle className="mr-2 h-4 w-4" />
          Cancel Booking
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {previewLoading && (
                <div className="flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Calculating refund...
                </div>
              )}

              {preview && !previewLoading && (
                <div className="rounded-lg border bg-muted/50 p-3 text-sm">
                  {preview.isUnpaid ? (
                    <p>This is an unpaid admin-created booking. Cancelling will delete it and release the time slot.</p>
                  ) : (
                    <>
                      {preview.policy && (
                        <p className="mb-1">
                          <strong>Policy:</strong>{" "}
                          <span className="capitalize">{preview.policy}</span>
                          {preview.hoursUntilAppointment !== undefined && (
                            <span className="text-muted-foreground">
                              {" "}({preview.hoursUntilAppointment}h until appointment)
                            </span>
                          )}
                        </p>
                      )}
                      <p>{preview.message}</p>
                    </>
                  )}
                </div>
              )}

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}

              <div>
                <Label className="text-sm">Reason (optional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  rows={2}
                  className="mt-1"
                />
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep Booking</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleCancel();
            }}
            disabled={loading || previewLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {preview?.isUnpaid ? "Delete Booking" : "Cancel & Refund"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
