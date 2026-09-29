import { PasskeySection } from "@/components/settings/passkey-section";
import { TwoFactorSection } from "@/components/settings/two-factor-section";

export function AccountSecuritySections({
  showRecommendation = false,
}: {
  showRecommendation?: boolean;
}) {
  return (
    <>
      <PasskeySection />
      <TwoFactorSection showRecommendation={showRecommendation} />
    </>
  );
}
