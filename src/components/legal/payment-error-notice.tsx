import { Link } from "@/i18n/navigation";
import {
  DOCTOR_PAYMENT_ERROR_NOTICE,
  PATIENT_PAYMENT_ERROR_NOTICE,
  termsClausePath,
} from "@/lib/legal/payment-error-notices";

export function PaymentErrorNotice({
  kind,
  enabled,
}: {
  kind: "patient" | "doctor";
  enabled: boolean;
}) {
  if (!enabled) return null;
  if (kind === "patient") {
    return (
      <p className="text-sm text-muted-foreground">
        If a payment or refund goes wrong, we&apos;ll contact you to put it right. See{" "}
        <Link href={termsClausePath("patient")} className="underline">
          Payment errors
        </Link>{" "}
        in our Terms.
      </p>
    );
  }
  return (
    <p className="text-sm text-muted-foreground">
      If a payout or refund is made in error, we may correct it from future payouts, as set out in our{" "}
      <Link href={termsClausePath("doctor")} className="underline">
        Doctor terms
      </Link>
      .
    </p>
  );
}

export function paymentErrorNoticeCopy(kind: "patient" | "doctor"): string {
  return kind === "patient"
    ? PATIENT_PAYMENT_ERROR_NOTICE
    : DOCTOR_PAYMENT_ERROR_NOTICE;
}
