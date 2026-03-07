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

export const helpCategories: HelpCategory[] = [
  // ─── Getting Started ────────────────────────────────────────────────
  {
    id: "getting-started",
    title: "Getting Started",
    description:
      "Learn the basics of using MyDoctors360 as a patient or doctor.",
    icon: Rocket,
    color: {
      bg: "bg-blue-50 dark:bg-blue-950/30",
      text: "text-blue-600",
      border: "border-blue-200 dark:border-blue-800",
    },
    articles: [
      {
        id: "how-to-book",
        question: "How do I book an appointment?",
        answer:
          "Browse our doctor directory by specialty, location, or name. Select a doctor to view their profile, consultation types, and fees. Choose an available time slot from their calendar, then complete the booking with secure online payment via Stripe. You'll receive an instant confirmation email with all details including any video call link.",
        tags: ["booking", "appointment", "patient", "getting started"],
        audience: "patient",
      },
      {
        id: "patient-account-setup",
        question: "How do I create a patient account?",
        answer:
          "Click 'Sign Up' from the homepage and select 'Patient'. Enter your name, email, and a secure password. You'll receive a verification email — click the link to activate your account. Once verified, you can complete your profile with contact details, medical preferences, and preferred language.",
        tags: ["register", "account", "patient", "signup", "getting started"],
        audience: "patient",
      },
      {
        id: "doctor-profile-setup",
        question: "How do I set up my doctor profile?",
        answer:
          "After registering as a doctor, navigate to your Dashboard > Profile. Fill in your professional details: specialty, qualifications, languages spoken, consultation types (in-person and/or video), and your consultation fees. Upload a professional photo and write a bio. Your profile will be reviewed by our team within 24–48 hours before appearing in the directory.",
        tags: ["doctor", "profile", "setup", "onboarding", "getting started"],
        audience: "doctor",
      },
      {
        id: "setting-availability",
        question: "How do I set my availability and working hours?",
        answer:
          "Go to Dashboard > Calendar. Use the 'Add Schedule' button to create weekly recurring time blocks. For each block, set the day, start time, end time, slot duration (e.g. 30 min), and consultation type (in-person or video). You can create multiple blocks per day — for example, in-person mornings and video afternoons. Toggle individual schedules on/off without deleting them.",
        tags: [
          "availability",
          "schedule",
          "doctor",
          "hours",
          "working hours",
          "calendar",
        ],
        audience: "doctor",
      },
      {
        id: "video-consultation-how",
        question: "How do video consultations work?",
        answer:
          "When you book a video consultation, a secure video call link is generated and included in your confirmation email and dashboard. At the scheduled time, click the link to join the call — no software installation required. Both doctors and patients can join directly from their browser. The call is encrypted end-to-end for your privacy.",
        tags: [
          "video",
          "consultation",
          "call",
          "telemedicine",
          "virtual",
          "online",
        ],
        audience: "all",
      },
      {
        id: "supported-languages",
        question: "What languages does the platform support?",
        answer:
          "MyDoctors360 is available in English, German, Turkish, and French. You can switch languages at any time using the language selector in the header. Doctors can list the languages they speak on their profile, helping you find a specialist who speaks your language.",
        tags: [
          "language",
          "multilingual",
          "translation",
          "english",
          "german",
          "turkish",
          "french",
        ],
        audience: "all",
      },
    ],
  },

  // ─── Calendar & Scheduling ──────────────────────────────────────────
  {
    id: "calendar-scheduling",
    title: "Calendar & Scheduling",
    description:
      "Calendar sync, provider setup, ICS feeds, and availability management.",
    icon: Calendar,
    color: {
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      text: "text-emerald-600",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    articles: [
      {
        id: "calendar-sync-overview",
        question: "How does calendar sync work?",
        answer:
          "MyDoctors360 supports two-way calendar synchronization with your existing calendar:\n\n<strong>Import (External → Platform):</strong> Events from your connected calendar (Google, Outlook, or iCloud) are imported as blocked time slots. Patients will not see these times as available.\n\n<strong>Export (Platform → External):</strong> When a patient books an appointment, it's automatically added to your connected calendar. If a booking is cancelled, it's removed.\n\n<strong>Auto-Sync:</strong> A background job runs every 10 minutes to keep everything in sync. Google Calendar and Microsoft Outlook also support real-time webhooks for near-instant updates — changes reflect within seconds.\n\n<strong>Conflict Detection:</strong> If a newly synced calendar event conflicts with an existing booking, you'll receive an in-app notification alerting you to the overlap.",
        tags: [
          "calendar",
          "sync",
          "overview",
          "how it works",
          "import",
          "export",
          "two-way",
        ],
        audience: "doctor",
      },
      {
        id: "google-calendar-setup",
        question: "How do I connect Google Calendar?",
        answer:
          "1. Go to <strong>Dashboard → Settings → Calendar Integrations</strong>\n2. Click <strong>Connect Google Calendar</strong> — you'll be redirected to Google\n3. Sign in and grant permission to view and manage your calendar\n4. Select which calendar to sync from the dropdown\n5. Enable the sync toggle\n\nYour existing Google Calendar events will import within seconds. New bookings will automatically appear in your Google Calendar.\n\n<strong>Technical details:</strong> Uses OAuth 2.0 authentication with real-time push notifications (webhooks). Webhooks are automatically renewed before they expire. A 10-minute background sync runs as a fallback to catch any missed webhook events.",
        tags: [
          "google",
          "calendar",
          "setup",
          "connect",
          "oauth",
          "webhooks",
        ],
        audience: "doctor",
      },
      {
        id: "microsoft-calendar-setup",
        question: "How do I connect Microsoft Outlook Calendar?",
        answer:
          "1. Go to <strong>Dashboard → Settings → Calendar Integrations</strong>\n2. Click <strong>Connect Microsoft Calendar</strong> — you'll be redirected to Microsoft\n3. Sign in with your Microsoft/Outlook account and authorize access\n4. Select the calendar to sync\n5. Enable the sync toggle\n\nYour Outlook events will import and bookings will sync to your Microsoft calendar.\n\n<strong>Technical details:</strong> Uses Microsoft Graph API with OAuth 2.0. Supports webhook subscriptions (Graph Subscriptions) for near-real-time updates. A 10-minute background sync runs as a fallback.",
        tags: [
          "microsoft",
          "outlook",
          "calendar",
          "setup",
          "connect",
          "oauth",
          "graph",
        ],
        audience: "doctor",
      },
      {
        id: "apple-icloud-setup",
        question: "How do I connect Apple iCloud Calendar?",
        answer:
          "Apple iCloud uses the CalDAV protocol, which requires an app-specific password instead of OAuth:\n\n1. Go to <strong>appleid.apple.com → Sign-In and Security → App-Specific Passwords</strong>\n2. Generate a new app-specific password and copy it\n3. Go to <strong>Dashboard → Settings → Calendar Integrations</strong>\n4. Select <strong>Apple iCloud</strong> from the CalDAV provider list\n5. Enter your Apple ID email and the app-specific password\n6. Select your calendar and enable sync\n\n<strong>Important:</strong> Apple iCloud does not support webhooks, so sync relies on the 10-minute background job. There may be up to a 10-minute delay before iCloud calendar changes appear on the platform.\n\nThis method also works with other CalDAV providers like <strong>Fastmail</strong>, <strong>Nextcloud</strong>, and <strong>Synology Calendar</strong>.",
        tags: [
          "apple",
          "icloud",
          "caldav",
          "calendar",
          "setup",
          "app-specific password",
          "fastmail",
          "nextcloud",
        ],
        audience: "doctor",
      },
      {
        id: "calendar-provider-comparison",
        question:
          "What are the differences between Google, Microsoft, and Apple calendar sync?",
        answer:
          "<strong>Google Calendar:</strong> OAuth 2.0 login · Real-time webhooks · Instant sync + 10-min fallback · Full import & export\n\n<strong>Microsoft Outlook:</strong> OAuth 2.0 login · Real-time Graph subscriptions · Instant sync + 10-min fallback · Full import & export\n\n<strong>Apple iCloud (CalDAV):</strong> App-specific password · No webhooks (polling only) · 10-minute sync interval · Full import & export\n\nAll three providers support the same core features: importing external events as blocked time, exporting bookings to your calendar, automatic conflict detection, and cancellation sync. The main difference is that Google and Microsoft provide near-instant updates via webhooks, while Apple iCloud syncs every 10 minutes.",
        tags: [
          "comparison",
          "google",
          "microsoft",
          "apple",
          "difference",
          "providers",
          "features",
        ],
        audience: "doctor",
      },
      {
        id: "ics-feed",
        question: "What is the ICS subscription feed?",
        answer:
          "The ICS feed provides a read-only URL that any calendar application can subscribe to:\n\n1. Go to <strong>Dashboard → Settings → Calendar Integrations</strong>\n2. Find the <strong>ICS Feed</strong> section and click <strong>Generate Feed URL</strong>\n3. Copy the URL and add it as a subscription calendar in your preferred app\n\nThe feed works with Apple Calendar, Google Calendar, Outlook, Thunderbird, and any other app that supports ICS subscriptions. It auto-refreshes periodically and shows all your upcoming confirmed bookings.\n\n<strong>Security:</strong> The URL contains a secret token — do not share it publicly. You can revoke and regenerate the token at any time from Settings.",
        tags: [
          "ics",
          "feed",
          "subscription",
          "read-only",
          "calendar",
          "url",
        ],
        audience: "doctor",
      },
      {
        id: "slot-locking",
        question: "How does appointment slot locking work?",
        answer:
          "When a patient begins the checkout process for a time slot, that slot is immediately locked with a <strong>pending_payment</strong> status for 15 minutes. During this time, no other patient can book the same slot — preventing double-bookings.\n\nIf payment is not completed within 15 minutes, the lock automatically expires and the slot becomes available again. A background cleanup job ensures expired locks are released promptly.",
        tags: [
          "slot",
          "locking",
          "booking",
          "double-booking",
          "checkout",
          "pending",
        ],
        audience: "all",
      },
      {
        id: "conflict-detection",
        question:
          "What happens when a calendar event conflicts with a booking?",
        answer:
          "When calendar sync imports a blocked time that overlaps with an existing confirmed booking, the system automatically:\n\n1. <strong>Detects the conflict</strong> by comparing the synced block times with your existing bookings\n2. <strong>Sends an in-app notification</strong> with details including the booking date/time and which calendar provider caused the conflict\n3. You can then <strong>contact the patient</strong> to reschedule if needed\n\nConflict detection runs after every sync — both real-time webhook syncs and the 10-minute background job.",
        tags: [
          "conflict",
          "detection",
          "notification",
          "overlap",
          "calendar",
          "booking",
        ],
        audience: "doctor",
      },
      {
        id: "date-overrides",
        question: "How do date overrides work?",
        answer:
          "Date overrides let you customize availability for specific dates without changing your weekly schedule:\n\n• <strong>Block a date:</strong> Mark a specific date as unavailable (e.g. holidays, personal days, conferences)\n• <strong>Custom hours:</strong> Set different hours for a specific date\n• <strong>Synced blocks:</strong> Calendar sync automatically creates overrides when it detects events in your external calendar — these show a provider badge (e.g. 'Google Sync') and cannot be manually deleted\n\nOverrides always take precedence over your weekly recurring schedule.",
        tags: [
          "override",
          "date",
          "block",
          "holiday",
          "custom hours",
          "availability",
        ],
        audience: "doctor",
      },
    ],
  },

  // ─── Payments & Billing ─────────────────────────────────────────────
  {
    id: "payments-billing",
    title: "Payments & Billing",
    description:
      "How payments work, refunds, and doctor payouts via Stripe Connect.",
    icon: CreditCard,
    color: {
      bg: "bg-amber-50 dark:bg-amber-950/30",
      text: "text-amber-600",
      border: "border-amber-200 dark:border-amber-800",
    },
    articles: [
      {
        id: "how-payments-work",
        question: "How do payments work on MyDoctors360?",
        answer:
          "All payments are processed securely through <strong>Stripe</strong>, a PCI-compliant payment platform used by millions of businesses worldwide.\n\nWhen you book an appointment, your payment is held securely. After the consultation is completed, the doctor receives their payout minus a 15% platform service fee. We support major credit/debit cards and local payment methods depending on your region.\n\nAll prices are displayed in your local currency (EUR, GBP, TRY, or USD).",
        tags: [
          "payment",
          "stripe",
          "how it works",
          "secure",
          "credit card",
          "currency",
        ],
        audience: "all",
      },
      {
        id: "refund-policy",
        question: "How do refunds work?",
        answer:
          "If you cancel within the doctor's cancellation window, your refund is processed automatically back to your original payment method. Refunds typically appear within 5–10 business days depending on your bank.\n\nIf a <strong>doctor cancels</strong> your appointment, you always receive a full refund — no questions asked.\n\nEach doctor sets their own cancellation policy (visible on their profile), so please review it before booking.",
        tags: [
          "refund",
          "cancellation",
          "money back",
          "cancel",
          "policy",
          "patient",
        ],
        audience: "patient",
      },
      {
        id: "doctor-payouts",
        question: "How and when do doctors receive payouts?",
        answer:
          "Doctors receive payouts through <strong>Stripe Connect</strong>. After completing your Stripe onboarding (Dashboard → Payments), payouts are processed automatically:\n\n• Platform fee: 15% is deducted as a service fee\n• Payout schedule: Funds are transferred to your bank account on Stripe's standard schedule (typically 2–7 business days after the consultation)\n• You can view all transactions, pending payouts, and earnings history in Dashboard → Payments",
        tags: [
          "payout",
          "earnings",
          "doctor",
          "stripe connect",
          "bank",
          "transfer",
          "fee",
        ],
        audience: "doctor",
      },
      {
        id: "stripe-onboarding",
        question: "How do I set up Stripe Connect as a doctor?",
        answer:
          "To receive payments, you need to complete Stripe onboarding:\n\n1. Go to <strong>Dashboard → Payments</strong>\n2. Click <strong>Set Up Payments</strong> — you'll be redirected to Stripe\n3. Provide your business/personal details, bank account, and identity verification\n4. Once verified, you're ready to receive patient bookings and payouts\n\nStripe onboarding typically takes 5–10 minutes. In some cases, additional verification may be needed.",
        tags: [
          "stripe",
          "onboarding",
          "setup",
          "connect",
          "payments",
          "doctor",
          "bank",
        ],
        audience: "doctor",
      },
      {
        id: "supported-currencies",
        question: "What currencies are supported?",
        answer:
          "MyDoctors360 supports multiple currencies to serve our international user base:\n\n• <strong>EUR</strong> (Euro) — Default for most European countries\n• <strong>GBP</strong> (British Pound)\n• <strong>TRY</strong> (Turkish Lira)\n• <strong>USD</strong> (US Dollar)\n\nPrices are displayed in your local currency based on your location. Doctors set their consultation fees and the platform handles currency display automatically.",
        tags: [
          "currency",
          "euro",
          "pound",
          "lira",
          "dollar",
          "multi-currency",
          "international",
        ],
        audience: "all",
      },
    ],
  },

  // ─── Account & Settings ─────────────────────────────────────────────
  {
    id: "account-settings",
    title: "Account & Settings",
    description:
      "Profile management, notifications, security, and preferences.",
    icon: Settings,
    color: {
      bg: "bg-violet-50 dark:bg-violet-950/30",
      text: "text-violet-600",
      border: "border-violet-200 dark:border-violet-800",
    },
    articles: [
      {
        id: "update-profile",
        question: "How do I update my profile or contact information?",
        answer:
          "Log in to your dashboard and navigate to <strong>Settings</strong>. From there you can update your personal details, contact information, profile photo, and preferences. For doctors, profile changes (specialty, qualifications) may require re-verification.\n\nChanges take effect immediately across the platform.",
        tags: [
          "profile",
          "update",
          "edit",
          "contact",
          "settings",
          "personal",
        ],
        audience: "all",
      },
      {
        id: "notification-preferences",
        question: "How do I manage my notification preferences?",
        answer:
          "Go to <strong>Dashboard → Settings → Notifications</strong>. You can control which notifications you receive and through which channels:\n\n• <strong>In-app:</strong> Notifications appear in your dashboard notification bell\n• <strong>Email:</strong> Booking confirmations, reminders, and updates\n• <strong>SMS:</strong> Appointment reminders (where available)\n• <strong>WhatsApp:</strong> Quick booking updates (where available)\n\nYou can enable or disable each channel independently.",
        tags: [
          "notifications",
          "email",
          "sms",
          "whatsapp",
          "preferences",
          "alerts",
        ],
        audience: "all",
      },
      {
        id: "cancel-reschedule-booking",
        question: "How do I cancel or reschedule a booking?",
        answer:
          "Go to <strong>Dashboard → Bookings</strong> and find the appointment you want to change. Click the booking to view its details, then select <strong>Cancel</strong> or <strong>Reschedule</strong>.\n\nEach doctor sets their own cancellation policy — please review the cancellation window on the doctor's profile. Cancellations made within the allowed window are eligible for a full refund.",
        tags: [
          "cancel",
          "reschedule",
          "booking",
          "appointment",
          "change",
          "modify",
        ],
        audience: "patient",
      },
      {
        id: "doctor-subscription",
        question: "What are the doctor subscription plans?",
        answer:
          "MyDoctors360 offers subscription plans for doctors to unlock premium features:\n\n• <strong>Free:</strong> Basic profile listing with limited features\n• <strong>Premium:</strong> Full calendar integration, analytics dashboard, priority listing, advanced scheduling features, and more\n\nVisit <strong>Dashboard → Subscription</strong> to view plan details and manage your subscription. You can upgrade, downgrade, or cancel at any time.",
        tags: [
          "subscription",
          "plan",
          "premium",
          "pricing",
          "doctor",
          "upgrade",
        ],
        audience: "doctor",
      },
      {
        id: "account-security",
        question: "How do I keep my account secure?",
        answer:
          "We recommend these security practices:\n\n• Use a <strong>strong, unique password</strong> with at least 8 characters including numbers and special characters\n• <strong>Never share</strong> your login credentials with anyone\n• <strong>Log out</strong> after using shared or public computers\n• Contact support immediately if you notice any unauthorized activity\n\nAll data is encrypted in transit and at rest. We use industry-standard security practices to protect your information.",
        tags: [
          "security",
          "password",
          "account",
          "safety",
          "privacy",
          "protection",
        ],
        audience: "all",
      },
    ],
  },

  // ─── Troubleshooting ────────────────────────────────────────────────
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    description:
      "Solutions for common issues with calendar sync, payments, and video calls.",
    icon: Wrench,
    color: {
      bg: "bg-rose-50 dark:bg-rose-950/30",
      text: "text-rose-600",
      border: "border-rose-200 dark:border-rose-800",
    },
    articles: [
      {
        id: "calendar-not-syncing",
        question: "My calendar is not syncing — what should I do?",
        answer:
          "Try these steps in order:\n\n1. <strong>Check sync is enabled</strong> — Go to Settings → Calendar Integrations and verify the toggle is on\n2. <strong>Click 'Sync Now'</strong> — Go to Dashboard → Calendar and click the Sync Calendars button to trigger a manual sync\n3. <strong>Reconnect your calendar</strong> — For Google/Microsoft: disconnect and reconnect to refresh your OAuth tokens\n4. <strong>Check credentials</strong> — For Apple iCloud: verify your app-specific password hasn't been revoked at appleid.apple.com\n5. <strong>Verify the correct calendar</strong> is selected from the dropdown\n6. <strong>Wait 10 minutes</strong> — The background sync runs on a 10-minute cycle\n\nIf the issue persists after these steps, create a support ticket from your Dashboard → Support.",
        tags: [
          "troubleshooting",
          "sync",
          "not working",
          "calendar",
          "fix",
          "issue",
          "problem",
        ],
        audience: "doctor",
      },
      {
        id: "google-auth-expired",
        question:
          "Google Calendar shows 'Authorization expired' — how do I fix it?",
        answer:
          "OAuth tokens occasionally need refreshing, especially if you've changed your Google password or revoked access in your Google Security settings.\n\nTo fix:\n1. Go to <strong>Settings → Calendar Integrations</strong>\n2. Click <strong>Disconnect</strong> next to Google Calendar\n3. Click <strong>Connect Google Calendar</strong> again\n4. Re-authorize access through the Google sign-in screen\n5. Select your calendar and enable sync\n\nYour synced data will be preserved — only the authentication is refreshed.",
        tags: [
          "google",
          "auth",
          "expired",
          "token",
          "oauth",
          "troubleshooting",
          "authorization",
        ],
        audience: "doctor",
      },
      {
        id: "apple-password-revoked",
        question:
          "Apple iCloud sync stopped working after I changed my Apple ID password",
        answer:
          "When you change your Apple ID password, all app-specific passwords are automatically revoked. You need to generate a new one:\n\n1. Go to <strong>appleid.apple.com → Sign-In and Security → App-Specific Passwords</strong>\n2. Generate a new password\n3. Go to <strong>Settings → Calendar Integrations</strong>\n4. Update your CalDAV credentials with the new app-specific password\n5. Re-enable sync\n\nTip: Keep your app-specific password in a secure password manager so you can easily reference it.",
        tags: [
          "apple",
          "icloud",
          "password",
          "revoked",
          "caldav",
          "troubleshooting",
          "app-specific",
        ],
        audience: "doctor",
      },
      {
        id: "payment-failed",
        question: "My payment failed — what should I do?",
        answer:
          "Payment failures can happen for several reasons:\n\n• <strong>Insufficient funds</strong> — Check your bank balance\n• <strong>Card declined</strong> — Contact your bank to authorize the transaction\n• <strong>3D Secure failed</strong> — Try completing the authentication step again\n• <strong>Expired card</strong> — Update your card details and try again\n\nIf none of the above apply, try a different payment method. All payment processing is handled by Stripe with bank-level security. If the problem persists, contact support with the error message you see.",
        tags: [
          "payment",
          "failed",
          "declined",
          "error",
          "card",
          "troubleshooting",
          "charge",
        ],
        audience: "patient",
      },
      {
        id: "video-call-issues",
        question: "I'm having trouble joining a video consultation",
        answer:
          "If you're experiencing video call issues:\n\n1. <strong>Check your browser</strong> — Use a modern browser (Chrome, Firefox, Safari, or Edge). Ensure it's up to date.\n2. <strong>Grant permissions</strong> — Allow camera and microphone access when prompted\n3. <strong>Check your connection</strong> — A stable internet connection of at least 2 Mbps is recommended\n4. <strong>Try a different browser</strong> — If one browser doesn't work, try another\n5. <strong>Disable VPN</strong> — VPNs can sometimes interfere with video calls\n6. <strong>Close other apps</strong> — Close other video/audio applications that might be using your camera or microphone\n\nIf you still can't connect, contact your doctor through the messaging feature to arrange an alternative.",
        tags: [
          "video",
          "call",
          "consultation",
          "camera",
          "microphone",
          "connection",
          "troubleshooting",
        ],
        audience: "all",
      },
      {
        id: "booking-slot-unavailable",
        question:
          "A time slot disappeared while I was trying to book — why?",
        answer:
          "When another patient starts the checkout process for a time slot, that slot is temporarily locked for 15 minutes. This prevents double-bookings. The slot will either:\n\n• <strong>Be confirmed</strong> — if the other patient completes payment (the slot is taken)\n• <strong>Become available again</strong> — if the other patient doesn't complete payment within 15 minutes\n\nTip: If a slot you want is locked, check back in 15 minutes. You can also look for alternative times with the same doctor.",
        tags: [
          "slot",
          "unavailable",
          "disappeared",
          "locked",
          "booking",
          "double-booking",
          "troubleshooting",
        ],
        audience: "patient",
      },
      {
        id: "sync-delay-apple",
        question:
          "Why is there a delay with Apple iCloud calendar sync?",
        answer:
          "Apple iCloud (CalDAV) does not support real-time webhooks like Google and Microsoft. Instead, our system polls your iCloud calendar every 10 minutes for changes.\n\nThis means:\n• Changes in iCloud may take up to <strong>10 minutes</strong> to appear on MyDoctors360\n• Similarly, bookings may take up to 10 minutes to appear in iCloud\n\nFor faster sync, consider using Google Calendar or Microsoft Outlook, which both support real-time webhook notifications for near-instant updates.\n\nYou can also click <strong>Sync Now</strong> on the Calendar page to trigger an immediate sync at any time.",
        tags: [
          "apple",
          "delay",
          "slow",
          "icloud",
          "caldav",
          "10 minutes",
          "polling",
          "troubleshooting",
        ],
        audience: "doctor",
      },
    ],
  },
];
