"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
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
import { Loader2, ShieldBan, ShieldCheck } from "lucide-react";
import { adminTogglePatientSuspension } from "@/actions/admin";
import { toast } from "sonner";

interface SuspendPatientButtonProps {
  patientId: string;
  isBanned: boolean;
}

export function SuspendPatientButton({
  patientId,
  isBanned,
}: SuspendPatientButtonProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const result = await adminTogglePatientSuspension(patientId, !isBanned);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(
          isBanned
            ? "Patient account has been unsuspended"
            : "Patient account has been suspended"
        );
      }
      setOpen(false);
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant={isBanned ? "default" : "destructive"}
          size="sm"
          className="gap-1.5"
        >
          {isBanned ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5" />
              Unsuspend
            </>
          ) : (
            <>
              <ShieldBan className="h-3.5 w-3.5" />
              Suspend
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBanned ? "Unsuspend Patient Account" : "Suspend Patient Account"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBanned
              ? "This will restore the patient's ability to log in and use the platform."
              : "This will prevent the patient from logging in or making any bookings. They will be unable to access their account."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleToggle}
            disabled={isPending}
            className={isBanned ? "" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isBanned ? "Unsuspending..." : "Suspending..."}
              </>
            ) : isBanned ? (
              "Unsuspend Account"
            ) : (
              "Suspend Account"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
