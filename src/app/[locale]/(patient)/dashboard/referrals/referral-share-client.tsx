"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, MessageCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { sendPatientReferralInvite } from "@/actions/referral";

interface ReferralShareClientProps {
  referralCode: string;
  referralLink: string;
}

export function ReferralShareClient({
  referralCode,
  referralLink,
}: ReferralShareClientProps) {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const whatsappMessage = `I've been using MyDoctors360 to book private doctor appointments — it's brilliant! Use my link to sign up and we both earn 1,000 reward points!\n\n${referralLink}`;
  const twitterMessage = `Skip the NHS wait. I use @MyDoctors360 for private doctor bookings — video or in-person. Sign up with my link and we both earn rewards! ${referralLink}`;
  const socialMessage = `I've found an amazing platform for booking private healthcare appointments. Use my referral link and we both get 1,000 reward points! ${referralLink}`;

  function handleCopy() {
    navigator.clipboard.writeText(referralLink).then(() => {
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleWhatsApp() {
    window.open(
      `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`,
      "_blank"
    );
  }

  function handleTwitter() {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterMessage)}`,
      "_blank"
    );
  }

  function handleFacebook() {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}&quote=${encodeURIComponent(socialMessage)}`,
      "_blank"
    );
  }

  function handleLinkedIn() {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(referralLink)}`,
      "_blank"
    );
  }

  function handleSendInvite() {
    if (!email.trim()) {
      toast.error("Please enter an email address.");
      return;
    }

    startTransition(async () => {
      const result = await sendPatientReferralInvite(email.trim());

      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Invitation sent!");
        setEmail("");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Share Buttons Row */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          {copied ? "Copied!" : "Copy Link"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleWhatsApp}
          className="gap-2"
        >
          <MessageCircle className="h-4 w-4" />
          WhatsApp
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTwitter}
          className="gap-2"
        >
          <span className="text-sm font-bold leading-none">{"\ud835\udd4f"}</span>
          X / Twitter
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleFacebook}
          className="gap-2"
        >
          <span className="text-sm font-bold leading-none">f</span>
          Facebook
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleLinkedIn}
          className="gap-2"
        >
          <span className="text-sm font-bold leading-none">in</span>
          LinkedIn
        </Button>
      </div>

      {/* Email Invite Section */}
      <div className="space-y-2">
        <p className="text-sm font-medium">Invite by Email</p>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="friend@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleSendInvite();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSendInvite}
            disabled={isPending}
            className="gap-2 shrink-0"
          >
            <Mail className="h-4 w-4" />
            {isPending ? "Sending..." : "Send Invite"}
          </Button>
        </div>
      </div>
    </div>
  );
}
