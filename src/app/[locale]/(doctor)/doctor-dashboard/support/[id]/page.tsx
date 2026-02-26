import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, MessageSquare, Clock } from "lucide-react";
import { getTicketDetail } from "@/actions/support";
import { TicketReplyForm } from "../support-client";

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

export default async function DoctorTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getTicketDetail(id);

  if (result.error || !result.ticket) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/doctor-dashboard/support">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Support
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {result.error || "Ticket not found."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { ticket, messages } = result;
  const isClosed = ticket.status === "closed";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/doctor-dashboard/support">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Support
        </Link>
      </Button>

      {/* Ticket header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{ticket.subject}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{ticket.ticket_number}</span>
            <span>-</span>
            <span>
              {categoryLabels[ticket.category] || ticket.category}
            </span>
            <span>-</span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(ticket.created_at).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
            statusColors[ticket.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {statusLabels[ticket.status] || ticket.status}
        </span>
      </div>

      {/* Messages */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Conversation ({messages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!messages || messages.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No messages yet.
            </p>
          ) : (
            <div className="space-y-4">
              {messages.map((msg) => {
                const isSupport = msg.sender_role === "admin";
                return (
                  <div
                    key={msg.id}
                    className={`rounded-lg border p-4 ${
                      isSupport ? "border-primary/20 bg-primary/5" : "bg-muted/30"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {msg.sender_name}
                        </span>
                        {isSupport && (
                          <Badge variant="secondary" className="text-xs">
                            Support
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(msg.created_at).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reply form (hide if ticket is closed) */}
      {!isClosed ? (
        <TicketReplyForm ticketId={ticket.id} />
      ) : (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            This ticket is closed. If you need further help, please open a new
            ticket.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
