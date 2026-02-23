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
import { Star, Crown } from "lucide-react";

export default async function AdminFeaturedPage() {
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

  const { data: featured } = await supabase
    .from("doctors")
    .select(
      `id, slug, is_featured, featured_until, avg_rating, total_bookings,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name)`
    )
    .eq("is_featured", true)
    .order("featured_until", { ascending: true });

  const { data: topDoctors } = await supabase
    .from("doctors")
    .select(
      `id, slug, avg_rating, total_bookings, total_reviews,
       profile:profiles!doctors_profile_id_fkey(first_name, last_name)`
    )
    .eq("is_featured", false)
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("avg_rating", { ascending: false })
    .limit(10);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-yellow-500" />
        <h1 className="text-2xl font-bold">Featured Listings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Currently Featured ({featured?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Featured Until</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {featured?.map(
                (doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.profile.first_name} {doc.profile.last_name}
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      {Number(doc.avg_rating).toFixed(1)}
                    </TableCell>
                    <TableCell>{doc.total_bookings}</TableCell>
                    <TableCell>
                      {doc.featured_until
                        ? new Date(doc.featured_until).toLocaleDateString()
                        : "Indefinite"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/doctors/${doc.id}`}>
                        <Button variant="outline" size="sm">
                          Manage
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!featured || featured.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No featured doctors
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Rated Doctors (Candidates for Featuring)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Doctor</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead>Bookings</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topDoctors?.map(
                (doc: any) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">
                      {doc.profile.first_name} {doc.profile.last_name}
                    </TableCell>
                    <TableCell className="flex items-center gap-1">
                      <Star className="h-4 w-4 text-yellow-500" />
                      {Number(doc.avg_rating).toFixed(1)}
                    </TableCell>
                    <TableCell>{doc.total_reviews}</TableCell>
                    <TableCell>{doc.total_bookings}</TableCell>
                    <TableCell>
                      <Link href={`/admin/doctors/${doc.id}`}>
                        <Button variant="outline" size="sm">
                          Feature
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
