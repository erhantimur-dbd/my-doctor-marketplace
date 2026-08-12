import { NextResponse } from "next/server";
import { getFoundingProgrammeStatus } from "@/lib/founding/members";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/founding/status — public remaining founding spots.
 * Used by the static coming-soon page and register-doctor CTA.
 */
export async function GET() {
  const status = await getFoundingProgrammeStatus();
  return NextResponse.json({
    maxSpots: status.maxSpots,
    claimedSpots: status.claimedSpots,
    remainingSpots: status.remainingSpots,
    isOpen: status.isOpen,
  });
}
