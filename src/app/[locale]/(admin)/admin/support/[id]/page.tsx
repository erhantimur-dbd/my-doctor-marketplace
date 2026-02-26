import { getTicketDetail } from "@/actions/support";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, User, Clock, Tag, MessageSquare } from "lucide-react";
import {
  StatusSelect,
  PrioritySelect,
  AdminReplyForm,
} from "../support-admin-client";

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-700",
  normal: "bg-blue-100 text-blue-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-red-100 text-red-700",
};

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-amber-100 text-amber-700",
  waiting_on_customer: "bg-purple-100 text-purple-700",
  resolved: "bg-green-100 text-green-700",
  closed: "bg-gray-100 text-gray-700",
};

const roleColors: Record<string, string> = {
  patient: "bg-blue-100 text-blue-700",
  doctor: "bg-green-100 text-green-700",
};

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: ticketId } = await params;
  const result = await getTicketDetail(ticketId);

  if (result.error || !result.ticket) {
    redirect("/en/admin/support");
  }

  const { ticket, messages } = result;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Support Tickets
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Ticket {ticket.ticket_number}
          </h1>
          <p className="text-lg text-muted-foreground">{ticket.subject}</p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            statusColors[ticket.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {ticket.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Panel - Ticket Info */}
        <div className="space-y-6">
          {/* User Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                User Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Name</span>
                <span className="text-sm font-medium">{ticket.user_name}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Email</span>
                <span className="text-sm">{ticket.user_email}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge
                  variant="secondary"
                  className={`text-xs ${roleColors[ticket.user_role] || ""}`}
                >
                  {ticket.user_role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Ticket Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4" />
                Ticket Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {ticket.category}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Priority</span>
                <PrioritySelect
                  ticketId={ticket.id}
                  currentPriority={ticket.priority}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <StatusSelect
                  ticketId={ticket.id}
                  currentStatus={ticket.status}
                />
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Created</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.created_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Updated</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ticket.updated_at).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Messages */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="h-4 w-4" />
                Messages ({messages?.length || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {messages?.map((msg: any) => {
                const isAdmin = msg.sender_role === "admin";
                const isInternalNote = msg.is_internal_note;

                let bgColor = "bg-white border";
                if (isInternalNote) {
                  bgColor = "bg-amber-50 border border-amber-200";
                } else if (isAdmin) {
                  bgColor = "bg-blue-50 border border-blue-200";
                }

                return (
                  <div key={msg.id} className={`rounded-lg p-4 ${bgColor}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {msg.sender_name}
                        </span>
                        {isAdmin && !isInternalNote && (
                          <Badge
                            variant="secondary"
                            className="bg-blue-100 text-[10px] text-blue-700"
                          >
                            Support
                          </Badge>
                        )}
                        {isInternalNote && (
                          <Badge
                            variant="secondary"
                            className="bg-amber-100 text-[10px] text-amber-700"
                          >
                            Internal Note
                          </Badge>
                        )}
                      </div>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(msg.created_at).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm">{msg.message}</p>
                  </div>
                );
              })}

              {(!messages || messages.length === 0) && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No messages yet.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Reply Form */}
          {ticket.status !== "closed" && (
            <AdminReplyForm ticketId={ticket.id} />
          )}
        </div>
      </div>
    </div>
  );
}
