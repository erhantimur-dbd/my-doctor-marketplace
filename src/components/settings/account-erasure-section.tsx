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

      if (result.error) {
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

      toast.success("Your account has been erased. You will be redirected shortly.");
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
          Removes your sign-in and personal details. Prescriptions and their
          audit history are kept as clinical records. This cannot be undone.
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
                Your profile, contact details, and sign-in will be removed.
                Cancel active bookings first.
              </span>
              <span className="block text-sm">
                If nothing has to be kept, the account is deleted.
              </span>
              <span className="block text-sm">
                Prescriptions, medical details, reviews, and bookings stay
                linked to this account with personal details removed. A
                doctor listing is unpublished.
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
