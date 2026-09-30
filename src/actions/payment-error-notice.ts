"use server";

import { getRequestOriginAndLocale } from "@/lib/http/origin";
import {
  paymentErrorNoticesEnabled,
  termsClausePath,
} from "@/lib/legal/payment-error-notices";

export async function loadPaymentErrorNotice(kind: "patient" | "doctor") {
  if (!paymentErrorNoticesEnabled()) return null;
  const { locale } = await getRequestOriginAndLocale();
  return { href: termsClausePath(kind), locale };
}
