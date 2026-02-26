import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import { NewTicketForm } from "../support-client";

export default function DoctorNewTicketPage() {
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/doctor-dashboard/support">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Support
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">New Support Ticket</h1>
        <p className="text-muted-foreground">
          Describe your issue and our support team will assist you
        </p>
      </div>

      <NewTicketForm />
    </div>
  );
}
