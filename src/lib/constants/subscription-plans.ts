export const SUBSCRIPTION_PLANS = [
  {
    id: "basic",
    name: "Basic",
    description: "Essential tools for private practice",
    priceMonthly: 4900, // cents
    currency: "EUR",
    features: [
      "Public doctor profile",
      "Online booking calendar",
      "Up to 50 bookings/month",
      "Email reminders",
      "Basic analytics",
    ],
  },
  {
    id: "professional",
    name: "Professional",
    description: "Everything you need to grow your practice",
    priceMonthly: 9900,
    currency: "EUR",
    features: [
      "Everything in Basic",
      "Unlimited bookings",
      "SMS & WhatsApp reminders",
      "Video consultations",
      "Advanced analytics",
      "Patient CRM",
      "Priority support",
    ],
    popular: true,
  },
  {
    id: "premium",
    name: "Premium",
    description: "Maximum visibility and advanced features",
    priceMonthly: 19900,
    currency: "EUR",
    features: [
      "Everything in Professional",
      "Featured profile placement",
      "AI workflow automation",
      "Custom branding",
      "API access",
      "Dedicated account manager",
    ],
  },
] as const;
