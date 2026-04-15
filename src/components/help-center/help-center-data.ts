import {
  Rocket,
  Calendar,
  CreditCard,
  Settings,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export interface HelpArticle {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  audience: "patient" | "doctor" | "all";
}

export interface HelpCategory {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  color: { bg: string; text: string; border: string };
  articles: HelpArticle[];
}

// Category metadata (icons, colors) — locale-independent
const categoryMeta: Record<
  string,
  { icon: LucideIcon; color: { bg: string; text: string; border: string } }
> = {
  "getting-started": {
    icon: Rocket,
    color: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600",
      border: "border-blue-200 dark:border-blue-800",
    },
  },
  "calendar-scheduling": {
    icon: Calendar,
    color: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600",
      border: "border-emerald-200 dark:border-emerald-800",
    },
  },
  "payments-billing": {
    icon: CreditCard,
    color: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600",
      border: "border-amber-200 dark:border-amber-800",
    },
  },
  "account-settings": {
    icon: Settings,
    color: {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-600",
      border: "border-violet-200 dark:border-violet-800",
    },
  },
  troubleshooting: {
    icon: Wrench,
    color: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      text: "text-rose-600",
      border: "border-rose-200 dark:border-rose-800",
    },
  },
};

// Article definitions — tags are always in English for search, question/answer use i18n keys
interface ArticleDef {
  id: string;
  tags: string[];
  audience: "patient" | "doctor" | "all";
}

const articleDefs: Record<string, ArticleDef[]> = {
  "getting-started": [
    { id: "how-to-book", tags: ["booking", "appointment", "patient", "getting started"], audience: "patient" },
    { id: "patient-account-setup", tags: ["register", "account", "patient", "signup", "getting started"], audience: "patient" },
    { id: "doctor-profile-setup", tags: ["doctor", "profile", "setup", "onboarding", "getting started"], audience: "doctor" },
    { id: "setting-availability", tags: ["availability", "schedule", "doctor", "hours", "working hours", "calendar"], audience: "doctor" },
    { id: "video-consultation-how", tags: ["video", "consultation", "call", "telemedicine", "virtual", "online"], audience: "all" },
    { id: "supported-languages", tags: ["language", "multilingual", "translation", "english", "german", "turkish", "french"], audience: "all" },
  ],
  "calendar-scheduling": [
    { id: "calendar-sync-overview", tags: ["calendar", "sync", "overview", "how it works", "import", "export", "two-way"], audience: "doctor" },
    { id: "google-calendar-setup", tags: ["google", "calendar", "setup", "connect", "oauth", "webhooks"], audience: "doctor" },
    { id: "microsoft-calendar-setup", tags: ["microsoft", "outlook", "calendar", "setup", "connect", "oauth", "graph"], audience: "doctor" },
    { id: "apple-icloud-setup", tags: ["apple", "icloud", "caldav", "calendar", "setup", "app-specific password", "fastmail", "nextcloud"], audience: "doctor" },
    { id: "calendar-provider-comparison", tags: ["comparison", "google", "microsoft", "apple", "difference", "providers", "features"], audience: "doctor" },
    { id: "ics-feed", tags: ["ics", "feed", "subscription", "read-only", "calendar", "url"], audience: "doctor" },
    { id: "slot-locking", tags: ["slot", "locking", "booking", "double-booking", "checkout", "pending"], audience: "all" },
    { id: "conflict-detection", tags: ["conflict", "detection", "notification", "overlap", "calendar", "booking"], audience: "doctor" },
    { id: "date-overrides", tags: ["override", "date", "block", "holiday", "custom hours", "availability"], audience: "doctor" },
  ],
  "payments-billing": [
    { id: "how-payments-work", tags: ["payment", "stripe", "how it works", "secure", "credit card", "currency"], audience: "all" },
    { id: "refund-policy", tags: ["refund", "cancellation", "money back", "cancel", "policy", "patient"], audience: "patient" },
    { id: "doctor-payouts", tags: ["payout", "earnings", "doctor", "stripe connect", "bank", "transfer", "fee"], audience: "doctor" },
    { id: "stripe-onboarding", tags: ["stripe", "onboarding", "setup", "connect", "payments", "doctor", "bank"], audience: "doctor" },
    { id: "supported-currencies", tags: ["currency", "euro", "pound", "lira", "dollar", "multi-currency", "international"], audience: "all" },
  ],
  "account-settings": [
    { id: "update-profile", tags: ["profile", "update", "edit", "contact", "settings", "personal"], audience: "all" },
    { id: "notification-preferences", tags: ["notifications", "email", "sms", "whatsapp", "preferences", "alerts"], audience: "all" },
    { id: "cancel-reschedule-booking", tags: ["cancel", "reschedule", "booking", "appointment", "change", "modify"], audience: "patient" },
    { id: "doctor-subscription", tags: ["subscription", "plan", "licence", "pricing", "doctor", "upgrade", "starter", "professional", "clinic"], audience: "doctor" },
    { id: "account-security", tags: ["security", "password", "account", "safety", "privacy", "protection"], audience: "all" },
  ],
  troubleshooting: [
    { id: "calendar-not-syncing", tags: ["troubleshooting", "sync", "not working", "calendar", "fix", "issue", "problem"], audience: "doctor" },
    { id: "google-auth-expired", tags: ["google", "auth", "expired", "token", "oauth", "troubleshooting", "authorization"], audience: "doctor" },
    { id: "apple-password-revoked", tags: ["apple", "icloud", "password", "revoked", "caldav", "troubleshooting", "app-specific"], audience: "doctor" },
    { id: "payment-failed", tags: ["payment", "failed", "declined", "error", "card", "troubleshooting", "charge"], audience: "patient" },
    { id: "video-call-issues", tags: ["video", "call", "consultation", "camera", "microphone", "connection", "troubleshooting"], audience: "all" },
    { id: "booking-slot-unavailable", tags: ["slot", "unavailable", "disappeared", "locked", "booking", "double-booking", "troubleshooting"], audience: "patient" },
    { id: "sync-delay-apple", tags: ["apple", "delay", "slow", "icloud", "caldav", "10 minutes", "polling", "troubleshooting"], audience: "doctor" },
  ],
};

// Category order
const categoryOrder = [
  "getting-started",
  "calendar-scheduling",
  "payments-billing",
  "account-settings",
  "troubleshooting",
];

// i18n key mapping for category titles/descriptions
const categoryI18nKeys: Record<string, { title: string; desc: string }> = {
  "getting-started": { title: "cat_getting_started", desc: "cat_getting_started_desc" },
  "calendar-scheduling": { title: "cat_calendar", desc: "cat_calendar_desc" },
  "payments-billing": { title: "cat_payments", desc: "cat_payments_desc" },
  "account-settings": { title: "cat_account", desc: "cat_account_desc" },
  troubleshooting: { title: "cat_troubleshooting", desc: "cat_troubleshooting_desc" },
};

/**
 * Build localized help categories using a next-intl translator.
 * The translator should be scoped to the "helpCenter" namespace + "articles" sub-namespace.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getHelpCategories(
  t: (key: string) => string,
  tArticles: (key: string) => string,
  tArticlesRaw?: (key: string) => string
): HelpCategory[] {
  return categoryOrder.map((catId) => {
    const meta = categoryMeta[catId];
    const i18n = categoryI18nKeys[catId];
    const defs = articleDefs[catId];

    return {
      id: catId,
      title: t(i18n.title),
      description: t(i18n.desc),
      icon: meta.icon,
      color: meta.color,
      articles: defs.map((def) => ({
        id: def.id,
        question: tArticles(`${def.id}.question`),
        answer: (tArticlesRaw || tArticles)(`${def.id}.answer`),
        tags: def.tags,
        audience: def.audience,
      })),
    };
  });
}

// Fallback: English-only categories for backward compatibility / SSR
export { getHelpCategories as buildHelpCategories };

/**
 * Search articles by keyword matching against tags.
 * Used by the chat `answerFaq` tool to find relevant help articles.
 * Returns top matches sorted by tag-hit count (descending).
 */
export interface ArticleMatch {
  id: string;
  categoryId: string;
  tags: string[];
  audience: "patient" | "doctor" | "all";
  score: number;
}

export function searchArticlesByTags(
  query: string,
  maxResults = 3
): ArticleMatch[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2);

  if (words.length === 0) return [];

  const scored: ArticleMatch[] = [];

  for (const [categoryId, defs] of Object.entries(articleDefs)) {
    for (const def of defs) {
      let score = 0;
      for (const word of words) {
        for (const tag of def.tags) {
          if (tag.includes(word) || word.includes(tag)) {
            score++;
          }
        }
      }
      if (score > 0) {
        scored.push({
          id: def.id,
          categoryId,
          tags: def.tags,
          audience: def.audience,
          score,
        });
      }
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
}
