import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";

const statusColors: Record<string, string> = {
  verified: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  under_review: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  suspended: "bg-gray-100 text-gray-800",
};

export default async function AdminDoctorsPage() {
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

  const { data: doctors } = await supabase
    .from("doctors")
    .select(
      "id, slug, verification_status, is_active, is_featured, created_at, avg_rating, total_bookings, profile:profiles!doctors_profile_id_fkey(first_name, last_name, email)"
    )
    .order("created_at", { ascending: false });

  // Fetch active subscriptions to show plan per doctor
  const { data: subscriptions } = await supabase
    .from("doctor_subscriptions")
    .select("doctor_id, plan_id")
    .in("status", ["active", "trialing", "past_due"]);

  const subMap = new Map(
    (subscriptions || []).map((s: any) => [s.doctor_id, s.plan_id])
  );

  const { count: pendingCount } = await supabase
    .from("doctors")
    .select("*", { count: "exact", head: true })
    .eq("verification_status", "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Doctor Management</h1>
        {(pendingCount ?? 0) > 0 && (
          <Badge variant="destructive">{pendingCount} pending verification</Badge>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Doctors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Featured</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doctors?.map(
                (doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.profile.first_name} {doc.profile.last_name}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {doc.profile.email}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const plan = subMap.get(doc.id);
                        if (!plan || plan === "free") return <Badge variant="outline">Free</Badge>;
                        if (plan === "professional") return <Badge className="bg-blue-600">Professional</Badge>;
                        return <Badge variant="secondary" className="capitalize">{plan}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusColors[doc.verification_status] || "bg-gray-100"}`}
                      >
                        {doc.verification_status}
                      </span>
                    </TableCell>
                    <TableCell>{Number(doc.avg_rating).toFixed(1)}</TableCell>
                    <TableCell>{doc.total_bookings}</TableCell>
                    <TableCell>
                      {doc.is_active ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                    <TableCell>
                      {doc.is_featured ? (
                        <Badge variant="secondary">Featured</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Link href={`/doctors/${doc.slug}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Link href={`/admin/doctors/${doc.id}`}>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!doctors || doctors.length === 0) && (
                <TableRow>
                  <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No doctors registered yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
