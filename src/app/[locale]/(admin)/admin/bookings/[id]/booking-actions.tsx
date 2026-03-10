"use client";

import { useTransition } from "react";
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
import { Loader2, CheckCircle, XCircle, UserX } from "lucide-react";
import { adminUpdateBookingStatus } from "@/actions/admin";
import { toast } from "sonner";

interface BookingActionsProps {
  bookingId: string;
  currentStatus: string;
}

type StatusTransition = {
  newStatus: string;
  label: string;
  description: string;
  icon: React.ElementType;
  variant: "default" | "outline" | "destructive" | "secondary";
};

const TRANSITIONS: Record<string, StatusTransition[]> = {
  pending_approval: [
    {
      newStatus: "approved",
      label: "Approve",
      description: "Approve this booking. The doctor and patient will be notified.",
      icon: CheckCircle,
      variant: "default",
    },
    {
      newStatus: "rejected",
      label: "Reject",
      description: "Reject this booking request.",
      icon: XCircle,
      variant: "destructive",
    },
  ],
  confirmed: [
    {
      newStatus: "completed",
      label: "Mark Completed",
      description: "Mark this appointment as completed.",
      icon: CheckCircle,
      variant: "default",
    },
    {
      newStatus: "no_show",
      label: "No Show",
      description: "Mark this appointment as a no-show.",
      icon: UserX,
      variant: "secondary",
    },
    // Cancel now handled by AdminCancelButton with policy-aware refunds
  ],
  approved: [
    {
      newStatus: "completed",
      label: "Mark Completed",
      description: "Mark this appointment as completed.",
      icon: CheckCircle,
      variant: "default",
    },
    {
      newStatus: "no_show",
      label: "No Show",
      description: "Mark this appointment as a no-show.",
      icon: UserX,
      variant: "secondary",
    },
    // Cancel now handled by AdminCancelButton with policy-aware refunds
  ],
};

function StatusButton({ bookingId, transition }: { bookingId: string; transition: StatusTransition }) {
  const [isPending, startTransition] = useTransition();
  const Icon = transition.icon;

  const handleAction = () => {
    startTransition(async () => {
      const result = await adminUpdateBookingStatus(bookingId, transition.newStatus);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Booking status updated to ${transition.newStatus.replace(/_/g, " ")}`);
      }
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant={transition.variant} size="sm" className="gap-1.5" disabled={isPending}>
          {isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Icon className="h-3.5 w-3.5" />
          )}
          {transition.label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{transition.label} Booking</AlertDialogTitle>
          <AlertDialogDescription>{transition.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleAction} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              `Confirm ${transition.label}`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function BookingActions({ bookingId, currentStatus }: BookingActionsProps) {
  const transitions = TRANSITIONS[currentStatus];

  if (!transitions || transitions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {transitions.map((t) => (
        <StatusButton key={t.newStatus} bookingId={bookingId} transition={t} />
      ))}
    </div>
  );
}
