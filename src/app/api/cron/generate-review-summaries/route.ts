import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateReviewSummary } from "@/lib/ai/review-summarizer";
import { isAIEnabled } from "@/lib/ai/provider";

const MAX_DOCTORS_PER_RUN = 20;
const MIN_REVIEWS_FOR_SUMMARY = 3;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isAIEnabled()) {
    return NextResponse.json({ skipped: true, reason: "AI not configured" });
  }

  const supabase = createAdminClient();

  // Find doctors that need summary generation:
  // 1. Have enough reviews
  // 2. Either no summary exists OR review count has changed
  const { data: doctors, error: doctorError } = await supabase
    .from("doctors")
    .select("id, total_reviews")
    .gte("total_reviews", MIN_REVIEWS_FOR_SUMMARY)
    .eq("is_active", true)
    .eq("verification_status", "verified")
    .order("total_reviews", { ascending: false })
    .limit(100);

  if (doctorError || !doctors) {
    return NextResponse.json(
      { error: doctorError?.message || "No doctors found" },
      { status: 500 }
    );
  }

  // Check which doctors need an update
  const doctorIds = doctors.map((d) => d.id);
  const { data: existingSummaries } = await supabase
    .from("doctor_review_summaries")
    .select("doctor_id, review_count_at_generation")
    .in("doctor_id", doctorIds);

  const summaryMap = new Map(
    (existingSummaries || []).map((s) => [
      s.doctor_id,
      s.review_count_at_generation,
    ])
  );

  const doctorsNeedingUpdate = doctors.filter((d) => {
    const existingCount = summaryMap.get(d.id);
    return existingCount === undefined || existingCount !== d.total_reviews;
  });

  const batch = doctorsNeedingUpdate.slice(0, MAX_DOCTORS_PER_RUN);
  let generated = 0;
  let failed = 0;

  for (const doctor of batch) {
    // Fetch all visible reviews for this doctor
    const { data: reviews } = await supabase
      .from("reviews")
      .select("rating, title, comment")
      .eq("doctor_id", doctor.id)
      .eq("is_visible", true)
      .order("created_at", { ascending: false });

    if (!reviews || reviews.length < MIN_REVIEWS_FOR_SUMMARY) continue;

    const summary = await generateReviewSummary(reviews);
    if (!summary) {
      failed++;
      continue;
    }

    // Upsert the summary
    const { error: upsertError } = await supabase
      .from("doctor_review_summaries")
      .upsert(
        {
          doctor_id: doctor.id,
          summary_text: summary.summary,
          sentiment_tags: summary.sentimentTags,
          overall_sentiment: summary.overallSentiment,
          review_count_at_generation: doctor.total_reviews,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "doctor_id" }
      );

    if (upsertError) {
      console.error(
        `Failed to upsert summary for doctor ${doctor.id}:`,
        upsertError
      );
      failed++;
      continue;
    }

    // Also update the doctor's ai_sentiment_tags for Smart Match scoring
    await supabase
      .from("doctors")
      .update({ ai_sentiment_tags: summary.sentimentTags })
      .eq("id", doctor.id);

    generated++;
  }

  return NextResponse.json({
    total_eligible: doctorsNeedingUpdate.length,
    processed: batch.length,
    generated,
    failed,
  });
}
