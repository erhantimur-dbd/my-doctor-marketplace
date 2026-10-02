"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { requestAccountDeletion } from "@/actions/patient";

const OPEN_DISPUTE_ERASURE_MESSAGE =
  "We can't fully delete your account while a dispute is open. We've closed it so it can't be used, and we'll delete what we can once the dispute is resolved.";

export function AccountErasureSection() {
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const router = useRouter();

  function handleDeleteAccount() {
    if (deleteConfirmation !== "DELETE") {
      toast.error('Please type "DELETE" to confirm.');
      return;
    }

    startDeleteTransition(async () => {
      const result = await requestAccountDeletion();

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      try {
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        await supabase.auth.signOut();
      } catch {
        // The auth user is banned or deleted either way.
      }

      toast.success(
        "fallbackReason" in result && result.fallbackReason === "open_dispute"
          ? OPEN_DISPUTE_ERASURE_MESSAGE
          : "Your account is closed. You will be redirected shortly."
      );
      setDeleteDialogOpen(false);

      setTimeout(() => {
        router.push("/");
      }, 2000);
    });
  }

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
      <div className="space-y-1">
        <h4 className="text-sm font-medium text-destructive">Delete Account</h4>
        <p className="text-xs text-muted-foreground">
          Removes your sign-in and personal details. If a record has to
          stay, the account is restricted and you can still request access
          to it. This cannot be undone.
        </p>
      </div>
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="destructive" size="sm">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Your Account
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <span className="block">
                Your sign-in, contact details, and marketing preferences
                are removed. Cancel active bookings first.
              </span>
              <span className="block text-sm">
                If nothing has to be kept, the account is deleted.
              </span>
              <span className="block text-sm">
                If a record has to stay, the account is restricted.
                Prescriptions and bookings stay linked. Medical details stay
                only when they were shared with a doctor for a booking.
                Review ratings stay and the written review is removed unless
                a dispute is still open. A doctor listing is unpublished.
                You can still request access to what stays.
              </span>
              <span className="mt-2 block font-medium text-destructive">
                This action cannot be undone.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="delete-confirm">
              Type <span className="font-mono font-bold">DELETE</span> to confirm
            </Label>
            <Input
              id="delete-confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteConfirmation("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== "DELETE" || isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Permanently Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
