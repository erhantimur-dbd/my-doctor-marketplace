import { requireAdminPage } from "@/lib/admin/require-admin-page";
import {
  getAdminContactInquiries,
} from "@/actions/admin";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Inbox } from "lucide-react";
import { InquiryActions } from "./inquiry-actions";
import { Link } from "@/i18n/navigation";

const statusColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  read: "bg-gray-100 text-gray-700",
  replied: "bg-green-100 text-green-700",
  archived: "bg-muted text-muted-foreground",
};

const typeLabels: Record<string, string> = {
  doctor_onboarding: "Doctor onboarding",
  partnership: "Partnership",
  press: "Press",
  general: "General",
};

export default async function AdminInquiriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string }>;
}) {
  await requireAdminPage();
  const { status, type } = await searchParams;

  const { inquiries } = await getAdminContactInquiries({
    status: status || "all",
    inquiry_type: type || "all",
  });

  const newCount = inquiries.filter((i: { status: string }) => i.status === "new")
    .length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Mail className="h-6 w-6" />
            Contact Inquiries
          </h1>
          <p className="text-sm text-muted-foreground">
            Submissions from the public contact form
          </p>
        </div>
        {newCount > 0 && (
          <Badge className="text-sm">
            <Inbox className="mr-1 h-3.5 w-3.5" />
            {newCount} new
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["new", "New"],
            ["read", "Read"],
            ["replied", "Replied"],
            ["archived", "Archived"],
          ] as const
        ).map(([value, label]) => {
          const active = (status || "all") === value;
          const href =
            value === "all"
              ? `/admin/inquiries${type && type !== "all" ? `?type=${type}` : ""}`
              : `/admin/inquiries?status=${value}${type && type !== "all" ? `&type=${type}` : ""}`;
          return (
            <Link
              key={value}
              href={href}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="p-0">
          {inquiries.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">
              No inquiries found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Message</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inquiries.map((inq: any) => (
                  <TableRow key={inq.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(inq.created_at).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{inq.name}</p>
                      <a
                        href={`mailto:${inq.email}`}
                        className="text-xs text-primary hover:underline"
                      >
                        {inq.email}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm">
                      {typeLabels[inq.inquiry_type] || inq.inquiry_type}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-3 text-sm">{inq.message}</p>
                      {inq.admin_notes && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Note: {inq.admin_notes}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={statusColors[inq.status] || ""}
                      >
                        {inq.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <InquiryActions
                        inquiryId={inq.id}
                        currentStatus={inq.status}
                        currentNotes={inq.admin_notes || ""}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
