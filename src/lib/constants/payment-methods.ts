export const PAYMENT_METHODS = [
  { value: "insurance", labelKey: "payment_insurance" },
  { value: "bank_transfer", labelKey: "payment_bank_transfer" },
  { value: "instant_transfer", labelKey: "payment_instant_transfer" },
  { value: "credit_card", labelKey: "payment_credit_card" },
  { value: "debit_card", labelKey: "payment_debit_card" },
  { value: "cash", labelKey: "payment_cash" },
  { value: "paypal", labelKey: "payment_paypal" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["value"];
