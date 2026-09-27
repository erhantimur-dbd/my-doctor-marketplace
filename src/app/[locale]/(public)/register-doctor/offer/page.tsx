import type { Metadata } from "next";
import { getOfferSignupPreview } from "@/lib/offers/signup";
import { OfferSignupForm } from "./offer-signup-form";

export const metadata: Metadata = {
  title: "Annual plan offer",
  robots: { index: false, follow: false },
};

export default async function OfferSignupPage({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const preview = await getOfferSignupPreview(invite);
  if (!preview) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-2xl font-bold">This signup link is not valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the person who invited you for a new link.
        </p>
      </div>
    );
  }
  return <OfferSignupForm preview={preview} />;
}
