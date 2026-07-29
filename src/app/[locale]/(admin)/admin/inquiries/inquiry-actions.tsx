"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { updateContactInquiryStatus } from "@/actions/admin";
import { useRouter } from "@/i18n/navigation";

type InquiryStatus = "new" | "read" | "replied" | "archived";

interface InquiryActionsProps {
  inquiryId: string;
  currentStatus: string;
  currentNotes: string;
}

export function InquiryActions({
  inquiryId,
  currentStatus,
  currentNotes,
}: InquiryActionsProps) {
  const router = useRouter();
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState(currentNotes);
  const [saving, setSaving] = useState(false);

  async function setStatus(status: InquiryStatus) {
    setSaving(true);
    const result = await updateContactInquiryStatus(inquiryId, status);
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success(`Marked as ${status}`);
    router.refresh();
  }

  async function saveNotes() {
    setSaving(true);
    const result = await updateContactInquiryStatus(
      inquiryId,
      (currentStatus as InquiryStatus) || "read",
      notes
    );
    setSaving(false);
    if (result?.error) {
      toast.error(result.error);
      return;
    }
    toast.success("Notes saved");
    setNotesOpen(false);
    router.refresh();
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" disabled={saving}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setStatus("read")}>
            Mark read
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatus("replied")}>
            Mark replied
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatus("archived")}>
            Archive
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setStatus("new")}>
            Mark new
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setNotesOpen(true)}>
            Edit notes
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin notes</DialogTitle>
          </DialogHeader>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            placeholder="Internal notes about this inquiry..."
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNotesOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveNotes} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
