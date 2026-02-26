import { getMyTickets } from "@/actions/support";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Clock } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Support Tickets",
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

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function SupportPage() {
  const { tickets, error } = await getMyTickets();

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Support Tickets</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Unable to load support tickets. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Support Tickets</h1>
        <Button asChild>
          <Link href="/dashboard/support/new">
            <Plus className="mr-2 h-4 w-4" />
            New Ticket
          </Link>
        </Button>
      </div>

      {tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <MessageSquare className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">
              No support tickets yet
            </h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Need help with your account, bookings, or billing? Our support
              team is here to assist you.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/dashboard/support/new">
                <Plus className="mr-2 h-4 w-4" />
                Create your first ticket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              href={`/dashboard/support/${ticket.id}`}
            >
              <Card className="transition-all hover:border-primary/50 hover:shadow-md">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-start gap-2">
                        <p className="font-semibold">{ticket.subject}</p>
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

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span className="font-mono text-xs">
                          {ticket.ticket_number}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          {formatRelativeTime(ticket.updated_at)}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          {ticket.message_count}{" "}
                          {ticket.message_count === 1 ? "message" : "messages"}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
