"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sendReferralInvitation } from "@/actions/referral";
import {
  Loader2,
  Send,
  Copy,
  Check,
  Gift,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Copy Button
// ---------------------------------------------------------------------------

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCopy}
      className="shrink-0"
    >
      {copied ? (
        <>
          <Check className="mr-1.5 h-3.5 w-3.5 text-green-600" />
          Copied
        </>
      ) : (
        <>
          <Copy className="mr-1.5 h-3.5 w-3.5" />
          Copy
        </>
      )}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Invite Form
// ---------------------------------------------------------------------------

export function InviteForm() {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;

    setMessage(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("colleague_name", name);
      formData.set("colleague_email", email);

      const result = await sendReferralInvitation(formData);

      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({
          type: "success",
          text: `Invitation sent to ${email}!`,
        });
        setName("");
        setEmail("");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="invite-name" className="text-sm">
            Colleague&apos;s Name
          </Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Dr. Jane Doe"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-email" className="text-sm">
            Colleague&apos;s Email *
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jane@clinic.com"
            required
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending || !email}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Send Invitation
        </Button>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Gift className="h-3.5 w-3.5 text-emerald-600" />
          Both of you get 1 month free
        </span>
      </div>

      {message && (
        <p
          className={`text-sm ${
            message.type === "success"
              ? "text-emerald-600"
              : "text-destructive"
          }`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
