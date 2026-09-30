"use client";

import { useEffect, useState } from "react";
import { loadPaymentErrorNotice } from "@/actions/payment-error-notice";
import { PaymentErrorNotice } from "@/components/legal/payment-error-notice";

export function DoctorPaymentErrorNotice() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPaymentErrorNotice("doctor").then((notice) => {
      if (!cancelled) setEnabled(Boolean(notice));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <PaymentErrorNotice kind="doctor" enabled={enabled} />;
}
