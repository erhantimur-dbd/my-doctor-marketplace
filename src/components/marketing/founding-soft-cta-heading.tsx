import { FOUNDING_FREE_SOFT_LAUNCH_VALUE_LINE } from "@/lib/constants/company";

/**
 * Soft Launch Soft CTA chrome for register-doctor.
 * Single source for the Join / Thanks H1 + perk line.
 */
export function FoundingSoftCtaHeading({
  title = "Join the Founding Doctor Programme",
}: {
  title?: "Join the Founding Doctor Programme" | "Thanks";
}) {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {FOUNDING_FREE_SOFT_LAUNCH_VALUE_LINE}
      </p>
    </div>
  );
}
