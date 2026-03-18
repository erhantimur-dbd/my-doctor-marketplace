import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollText } from "lucide-react";
import { AuditLogFilters } from "./audit-log-filters";
import { AuditMetadataCell } from "./audit-metadata-cell";

const actionColors: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  activated: "bg-green-100 text-green-700",
  featured: "bg-blue-100 text-blue-700",
  verified: "bg-green-100 text-green-700",
  hidden: "bg-yellow-100 text-yellow-700",
  deactivated: "bg-red-100 text-red-700",
  suspended: "bg-red-100 text-red-700",
  refunded: "bg-orange-100 text-orange-700",
  rejected: "bg-red-100 text-red-700",
  deleted: "bg-red-100 text-red-700",
};

function getActionColor(action: string): string {
  for (const [key, color] of Object.entries(actionColors)) {
    if (action.includes(key)) return color;
  }
  return "bg-gray-100 text-gray-700";
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ action?: string; from?: string; to?: string; page?: string }>;
}) {
  const { action, from, to, page: pageStr } = await searchParams;
  const page = Math.max(1, parseInt(pageStr || "1", 10));
  const pageSize = 50;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/en");

  let query = supabase
    .from("audit_log")
    .select(
      `id, action, target_type, target_id, metadata, created_at,
       actor:profiles!audit_log_actor_id_fkey(first_name, last_name, email)`
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (action) {
    query = query.ilike("action", `%${action}%`);
  }
  if (from) {
    query = query.gte("created_at", `${from}T00:00:00`);
  }
  if (to) {
    query = query.lte("created_at", `${to}T23:59:59`);
  }

  const { data: logs } = await query;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <ScrollText className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Audit Log</h1>
      </div>

      <AuditLogFilters />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {logs?.length || 0} entries
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Target ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.map((log: any) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.actor
                      ? `${log.actor.first_name} ${log.actor.last_name}`
                      : "System"}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${getActionColor(log.action)}`}
                    >
                      {log.action.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {log.target_type}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-32 truncate font-mono text-xs">
                    {log.target_id}
                  </TableCell>
                  <TableCell className="max-w-48">
                    <AuditMetadataCell metadata={log.metadata} />
                  </TableCell>
                </TableRow>
              ))}
              {(!logs || logs.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-muted-foreground"
                  >
                    No audit log entries found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} &middot; Showing {logs?.length || 0} entries
        </p>
        <div className="flex gap-2">
          {page > 1 && (
            <a
              href={`?${new URLSearchParams({
                ...(action ? { action } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
                page: String(page - 1),
              }).toString()}`}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Previous
            </a>
          )}
          {(logs?.length || 0) >= pageSize && (
            <a
              href={`?${new URLSearchParams({
                ...(action ? { action } : {}),
                ...(from ? { from } : {}),
                ...(to ? { to } : {}),
                page: String(page + 1),
              }).toString()}`}
              className="inline-flex items-center rounded-lg border px-3 py-1.5 text-sm hover:bg-accent"
            >
              Next
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
