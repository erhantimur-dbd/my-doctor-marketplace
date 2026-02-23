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
import { Star } from "lucide-react";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-300"
          }`}
        />
      ))}
    </div>
  );
}

export default async function AdminReviewsPage() {
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

  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      `id, rating, title, comment, is_visible, created_at,
       patient:profiles!reviews_patient_id_fkey(first_name, last_name),
       doctor:doctors!inner(profile:profiles!doctors_profile_id_fkey(first_name, last_name))`
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Review Moderation</h1>

      <Card>
        <CardHeader>
          <CardTitle>All Reviews</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Visible</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reviews?.map(
                (review: any) => (
                  <TableRow key={review.id}>
                    <TableCell>
                      {review.patient.first_name} {review.patient.last_name}
                    </TableCell>
                    <TableCell>
                      {review.doctor.profile.first_name}{" "}
                      {review.doctor.profile.last_name}
                    </TableCell>
                    <TableCell>
                      <StarRating rating={review.rating} />
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {review.title || "-"}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {review.comment || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={review.is_visible ? "default" : "destructive"}
                      >
                        {review.is_visible ? "Visible" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(review.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              )}
              {(!reviews || reviews.length === 0) && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No reviews yet
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
