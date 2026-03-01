import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { Plus, MessageSquare, Clock } from "lucide-react";
import { getMyTickets } from "@/actions/support";

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting_on_customer: "bg-orange-100 text-orange-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-gray-100 text-gray-500",
};

const statusLabels: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  waiting_on_customer: "Waiting on You",
  resolved: "Resolved",
  closed: "Closed",
};

const categoryLabels: Record<string, string> = {
  billing: "Billing",
  booking: "Booking",
  account: "Account",
  technical: "Technical",
  verification: "Verification",
  other: "Other",
};

export default async function DoctorSupportPage() {
  const { tickets, error } = await getMyTickets();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground">
            Get help from the MyDoctors360 support team
          </p>
        </div>
        <Button asChild>
          <Link href="/doctor-dashboard/support/new">
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Your Tickets ({tickets.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center">
              <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <h3 className="text-lg font-medium">No support tickets</h3>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Need help? Create a new support ticket and our team will get
                back to you as soon as possible.
              </p>
              <Button asChild className="mt-4">
                <Link href="/doctor-dashboard/support/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Ticket
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/doctor-dashboard/support/${ticket.id}`}
                  className="block rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">
                          {ticket.subject}
                        </p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{ticket.ticket_number}</span>
                        <span>-</span>
                        <span>
                          {categoryLabels[ticket.category] || ticket.category}
                        </span>
                        <span>-</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(ticket.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {ticket.message_count > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          <MessageSquare className="mr-1 h-3 w-3" />
                          {ticket.message_count}
                        </Badge>
                      )}
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusColors[ticket.status] ||
                          "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {statusLabels[ticket.status] || ticket.status}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
