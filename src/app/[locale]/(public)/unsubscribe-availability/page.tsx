import { unsubscribeByToken } from "@/actions/availability-alerts";
import { UnsubscribeClient } from "./unsubscribe-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe from availability alerts",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function UnsubscribeAvailabilityPage({
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const token = sp.token?.trim() || "";

  if (!token) {
    return (
      <UnsubscribeClient
        status="invalid"
        message="This unsubscribe link is missing or incomplete."
      />
    );
  }

  const result = await unsubscribeByToken(token);

  if (!result.success) {
    return (
      <UnsubscribeClient
        status="error"
        message={result.error || "Unable to unsubscribe."}
      />
    );
  }

  return (
    <UnsubscribeClient
      status="success"
      message={`You have been unsubscribed from availability alerts${
        result.doctorName ? ` for Dr. ${result.doctorName}` : ""
      }.`}
    />
  );
}
