import { getTicketDetail } from "@/actions/support";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, MessageSquare, Clock, Info } from "lucide-react";
import { TicketReplyForm } from "../support-client";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ticket Details",
};

function getStatusColor(status: string): string {
  switch (status) {
    case "open":
      return "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400";
    case "in_progress":
      return "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400";
    case "waiting_on_customer":
      return "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400";
    case "resolved":
      return "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400";
    case "closed":
      return "bg-gray-50 text-gray-700 dark:bg-gray-950 dark:text-gray-400";
    default:
      return "";
  }
}

function getCategoryColor(category: string): string {
  switch (category) {
    case "billing":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400";
    case "booking":
      return "bg-sky-50 text-sky-600 dark:bg-sky-950 dark:text-sky-400";
    case "account":
      return "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400";
    case "technical":
      return "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400";
    case "verification":
      return "bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400";
    case "other":
      return "bg-slate-50 text-slate-600 dark:bg-slate-950 dark:text-slate-400";
    default:
      return "";
  }
}

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TicketDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { id } = await params;
  const result = await getTicketDetail(id);

  if (result.error || !result.ticket) {
    notFound();
  }

  const { ticket, messages } = result;
  const isClosedOrResolved =
    ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/dashboard/support">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Support
        </Link>
      </Button>

      {/* Ticket header */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{ticket.subject}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {ticket.ticket_number}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge
              variant="outline"
              className={getStatusColor(ticket.status)}
            >
              {formatStatusLabel(ticket.status)}
            </Badge>
            <Badge
              variant="outline"
              className={getCategoryColor(ticket.category)}
            >
              {formatStatusLabel(ticket.category)}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Created {formatDateTime(ticket.created_at)}
        </div>
      </div>

      {/* Message thread */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Messages ({messages?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {messages && messages.length > 0 ? (
            messages.map((msg) => {
              const isAdmin = msg.sender_role === "admin";
              return (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    isAdmin
                      ? "border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30"
                      : "bg-white dark:bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">
                        {msg.sender_name}
                      </span>
                      {isAdmin && (
                        <Badge variant="secondary" className="text-xs">
                          Support Team
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(msg.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm whitespace-pre-wrap">
                    {msg.message}
                  </p>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No messages yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reply form or closed banner */}
      {isClosedOrResolved ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-4">
            <Info className="h-5 w-5 shrink-0 text-muted-foreground" />
            <div>
              <p className="font-medium text-sm">
                This ticket has been {ticket.status === "resolved" ? "resolved" : "closed"}.
              </p>
              <p className="text-sm text-muted-foreground">
                If you need further assistance, please{" "}
                <Link
                  href="/dashboard/support/new"
                  className="text-primary hover:underline"
                >
                  create a new ticket
                </Link>
                .
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reply</CardTitle>
          </CardHeader>
          <CardContent>
            <TicketReplyForm ticketId={ticket.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
