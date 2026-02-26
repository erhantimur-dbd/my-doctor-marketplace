"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send, StickyNote, MessageSquare } from "lucide-react";
import {
  updateTicketStatus,
  updateTicketPriority,
  replyToTicket,
  addInternalNote,
} from "@/actions/support";

// ============================================================
// TicketFilters
// ============================================================

const STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_customer", label: "Waiting on Customer" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

const CATEGORY_OPTIONS = [
  { value: "billing", label: "Billing" },
  { value: "booking", label: "Booking" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical" },
  { value: "verification", label: "Verification" },
  { value: "other", label: "Other" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") || "";
  const currentCategory = searchParams.get("category") || "";
  const currentPriority = searchParams.get("priority") || "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`?${params.toString()}`);
  }

  function clearFilters() {
    router.push("?");
  }

  const hasFilters = currentStatus || currentCategory || currentPriority;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        value={currentStatus || "all"}
        onValueChange={(val) => updateFilter("status", val)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentCategory || "all"}
        onValueChange={(val) => updateFilter("category", val)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Categories" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {CATEGORY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={currentPriority || "all"}
        onValueChange={(val) => updateFilter("priority", val)}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="All Priorities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear Filters
        </Button>
      )}
    </div>
  );
}

// ============================================================
// StatusSelect
// ============================================================

export function StatusSelect({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);

  function handleChange(newStatus: string) {
    setStatus(newStatus);
    startTransition(async () => {
      const result = await updateTicketStatus(ticketId, newStatus);
      if (result?.error) {
        toast.error(result.error);
        setStatus(currentStatus);
      } else {
        toast.success("Status updated");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      <Select value={status} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger className="h-7 w-[170px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// PrioritySelect
// ============================================================

export function PrioritySelect({
  ticketId,
  currentPriority,
}: {
  ticketId: string;
  currentPriority: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [priority, setPriority] = useState(currentPriority);

  function handleChange(newPriority: string) {
    setPriority(newPriority);
    startTransition(async () => {
      const result = await updateTicketPriority(ticketId, newPriority);
      if (result?.error) {
        toast.error(result.error);
        setPriority(currentPriority);
      } else {
        toast.success("Priority updated");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
      <Select
        value={priority}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="h-7 w-[120px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRIORITY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// AdminReplyForm
// ============================================================

export function AdminReplyForm({ ticketId }: { ticketId: string }) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [mode, setMode] = useState<"reply" | "note">("reply");

  function handleSubmit() {
    if (!message.trim()) {
      toast.error("Please enter a message.");
      return;
    }
    if (message.length > 5000) {
      toast.error("Message must be under 5,000 characters.");
      return;
    }

    startTransition(async () => {
      if (mode === "reply") {
        const formData = new FormData();
        formData.set("ticket_id", ticketId);
        formData.set("message", message.trim());
        const result = await replyToTicket(formData);
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Reply sent");
          setMessage("");
        }
      } else {
        const result = await addInternalNote(ticketId, message.trim());
        if (result?.error) {
          toast.error(result.error);
        } else {
          toast.success("Internal note added");
          setMessage("");
        }
      }
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {mode === "reply" ? (
            <>
              <MessageSquare className="h-4 w-4" />
              Reply to Customer
            </>
          ) : (
            <>
              <StickyNote className="h-4 w-4" />
              Internal Note
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "reply" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("reply")}
          >
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
            Reply to Customer
          </Button>
          <Button
            type="button"
            variant={mode === "note" ? "default" : "outline"}
            size="sm"
            onClick={() => setMode("note")}
            className={
              mode === "note"
                ? "bg-amber-600 hover:bg-amber-700"
                : ""
            }
          >
            <StickyNote className="mr-1.5 h-3.5 w-3.5" />
            Internal Note
          </Button>
        </div>

        {mode === "note" && (
          <p className="text-xs text-amber-600">
            Internal notes are only visible to admins and will not be sent to the
            customer.
          </p>
        )}

        <Textarea
          placeholder={
            mode === "reply"
              ? "Type your reply to the customer..."
              : "Add an internal note (not visible to customer)..."
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          maxLength={5000}
          disabled={isPending}
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {message.length}/5000
          </span>
          <Button onClick={handleSubmit} disabled={isPending || !message.trim()}>
            {isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" />
                {mode === "reply" ? "Send Reply" : "Add Note"}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
