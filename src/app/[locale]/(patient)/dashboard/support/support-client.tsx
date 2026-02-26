"use client";

import { useTransition, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { createTicket, replyToTicket } from "@/actions/support";

// ============================================================
// NewTicketForm
// ============================================================

const CATEGORIES = [
  { value: "billing", label: "Billing" },
  { value: "booking", label: "Booking" },
  { value: "account", label: "Account" },
  { value: "technical", label: "Technical" },
  { value: "other", label: "Other" },
];

export function NewTicketForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createTicket(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(
        `Ticket ${result.ticketNumber} created successfully.`
      );
      router.push(`/dashboard/support/${result.ticketId}`);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ticket Details</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} action={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select name="category" required>
              <SelectTrigger id="category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Subject</Label>
            <Input
              id="subject"
              name="subject"
              placeholder="Brief summary of your issue"
              maxLength={200}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">Max 200 characters</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              name="message"
              placeholder="Describe your issue in detail..."
              rows={6}
              maxLength={5000}
              required
              disabled={isPending}
            />
            <p className="text-xs text-muted-foreground">
              Max 5,000 characters
            </p>
          </div>

          <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Ticket...
              </>
            ) : (
              "Create Ticket"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ============================================================
// TicketReplyForm
// ============================================================

interface TicketReplyFormProps {
  ticketId: string;
}

export function TicketReplyForm({ ticketId }: TicketReplyFormProps) {
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await replyToTicket(formData);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success("Reply sent successfully.");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-4">
      <input type="hidden" name="ticket_id" value={ticketId} />

      <div className="space-y-2">
        <Label htmlFor="reply-message">Your Message</Label>
        <Textarea
          id="reply-message"
          name="message"
          placeholder="Type your reply..."
          rows={3}
          maxLength={5000}
          required
          disabled={isPending}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Send Reply
          </>
        )}
      </Button>
    </form>
  );
}
