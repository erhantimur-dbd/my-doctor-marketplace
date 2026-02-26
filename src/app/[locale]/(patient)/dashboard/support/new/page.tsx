import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { NewTicketForm } from "../support-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Support Ticket",
};

export default function NewTicketPage() {
  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/support">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Support
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-bold">Create Support Ticket</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Describe your issue and our support team will get back to you as soon
          as possible.
        </p>
      </div>

      <NewTicketForm />
    </div>
  );
}
