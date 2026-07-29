"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Search,
  Calendar,
  MessageSquare,
  Settings,
  Home,
  Star,
  Heart,
  CreditCard,
  HelpCircle,
  Stethoscope,
  BookOpen,
  Users,
  LayoutDashboard,
  ClipboardCheck,
  Building2,
  DollarSign,
  Tag,
  ScrollText,
  FileText,
  BarChart3,
  FlaskConical,
  Activity,
  ThumbsUp,
  Crown,
  ClipboardList,
  Mail,
  Wallet,
  Video,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/providers/auth-provider";

interface PaletteCommand {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  keywords?: string[];
}

const PUBLIC_COMMANDS: PaletteCommand[] = [
  {
    label: "Find a Doctor",
    href: "/doctors",
    icon: Search,
    group: "Navigation",
    keywords: ["search", "find", "doctor", "specialist"],
  },
  {
    label: "Specialties",
    href: "/specialties",
    icon: Stethoscope,
    group: "Navigation",
    keywords: ["specialty", "category"],
  },
  {
    label: "How It Works",
    href: "/how-it-works",
    icon: HelpCircle,
    group: "Navigation",
    keywords: ["help", "guide", "about"],
  },
  {
    label: "Blog",
    href: "/blog",
    icon: BookOpen,
    group: "Navigation",
    keywords: ["articles", "health", "news"],
  },
  {
    label: "Home",
    href: "/",
    icon: Home,
    group: "Navigation",
  },
];

const PATIENT_COMMANDS: PaletteCommand[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    group: "Dashboard",
  },
  {
    label: "My Bookings",
    href: "/dashboard/bookings",
    icon: Calendar,
    group: "Dashboard",
    keywords: ["appointments", "schedule"],
  },
  {
    label: "Messages",
    href: "/dashboard/messages",
    icon: MessageSquare,
    group: "Dashboard",
    keywords: ["chat", "inbox"],
  },
  {
    label: "My Reviews",
    href: "/dashboard/reviews",
    icon: Star,
    group: "Dashboard",
  },
  {
    label: "Saved Doctors",
    href: "/dashboard/favorites",
    icon: Heart,
    group: "Dashboard",
    keywords: ["favorites", "liked"],
  },
  {
    label: "Payments",
    href: "/dashboard/payments",
    icon: CreditCard,
    group: "Dashboard",
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
    group: "Dashboard",
    keywords: ["profile", "preferences", "account"],
  },
];

const DOCTOR_COMMANDS: PaletteCommand[] = [
  {
    label: "Doctor Dashboard",
    href: "/doctor-dashboard",
    icon: LayoutDashboard,
    group: "Doctor",
  },
  {
    label: "Manage Bookings",
    href: "/doctor-dashboard/bookings",
    icon: Calendar,
    group: "Doctor",
  },
  {
    label: "Calendar",
    href: "/doctor-dashboard/calendar",
    icon: Calendar,
    group: "Doctor",
    keywords: ["availability", "schedule"],
  },
  {
    label: "Patients",
    href: "/doctor-dashboard/patients",
    icon: Users,
    group: "Doctor",
  },
  {
    label: "Messages",
    href: "/doctor-dashboard/messages",
    icon: MessageSquare,
    group: "Doctor",
  },
  {
    label: "Doctor Settings",
    href: "/doctor-dashboard/settings",
    icon: Settings,
    group: "Doctor",
    keywords: ["profile", "account"],
  },
];

const ADMIN_COMMANDS: PaletteCommand[] = [
  {
    label: "Admin Overview",
    href: "/admin",
    icon: LayoutDashboard,
    group: "Admin",
    keywords: ["dashboard", "command centre", "hq"],
  },
  {
    label: "Approvals",
    href: "/admin/approvals",
    icon: ClipboardCheck,
    group: "Admin",
    keywords: ["verify", "doctors", "pending"],
  },
  {
    label: "Support Tickets",
    href: "/admin/support",
    icon: HelpCircle,
    group: "Admin",
    keywords: ["tickets", "helpdesk"],
  },
  {
    label: "Contact Inquiries",
    href: "/admin/inquiries",
    icon: Mail,
    group: "Admin",
    keywords: ["contact", "leads", "partnership"],
  },
  {
    label: "Doctors",
    href: "/admin/doctors",
    icon: Stethoscope,
    group: "Admin",
  },
  {
    label: "Patients",
    href: "/admin/patients",
    icon: Users,
    group: "Admin",
  },
  {
    label: "Organizations",
    href: "/admin/organizations",
    icon: Building2,
    group: "Admin",
    keywords: ["clinics", "orgs"],
  },
  {
    label: "Bookings",
    href: "/admin/bookings",
    icon: Calendar,
    group: "Admin",
    keywords: ["appointments"],
  },
  {
    label: "Reviews",
    href: "/admin/reviews",
    icon: Star,
    group: "Admin",
    keywords: ["moderation"],
  },
  {
    label: "Featured Doctors",
    href: "/admin/featured",
    icon: Crown,
    group: "Admin",
  },
  {
    label: "Waitlist",
    href: "/admin/waitlist",
    icon: ClipboardList,
    group: "Admin",
    keywords: ["launch", "regions"],
  },
  {
    label: "Revenue",
    href: "/admin/revenue",
    icon: DollarSign,
    group: "Admin",
    keywords: ["gmv", "fees", "money"],
  },
  {
    label: "Payments",
    href: "/admin/payments",
    icon: CreditCard,
    group: "Admin",
    keywords: ["fees", "ledger"],
  },
  {
    label: "Licenses",
    href: "/admin/licenses",
    icon: Wallet,
    group: "Admin",
    keywords: ["subscriptions", "mrr", "seats", "tiers"],
  },
  {
    label: "Coupons",
    href: "/admin/coupons",
    icon: Tag,
    group: "Admin",
    keywords: ["discounts", "promo"],
  },
  {
    label: "Blog",
    href: "/admin/blog",
    icon: FileText,
    group: "Admin",
    keywords: ["cms", "articles"],
  },
  {
    label: "Analytics",
    href: "/admin/analytics",
    icon: BarChart3,
    group: "Admin",
    keywords: ["metrics", "stats"],
  },
  {
    label: "NPS Surveys",
    href: "/admin/nps",
    icon: ThumbsUp,
    group: "Admin",
    keywords: ["satisfaction", "feedback", "nps", "surveys"],
  },
  {
    label: "Video Approvals",
    href: "/admin/video-approvals",
    icon: Video,
    group: "Admin",
    keywords: ["video", "intro", "approve"],
  },
  {
    label: "Email Tests",
    href: "/admin/email-tests",
    icon: FlaskConical,
    group: "Admin",
  },
  {
    label: "System Health",
    href: "/admin/health",
    icon: Activity,
    group: "Admin",
    keywords: ["cron", "status", "uptime", "env"],
  },
  {
    label: "Audit Log",
    href: "/admin/audit-log",
    icon: ScrollText,
    group: "Admin",
  },
  {
    label: "Platform Settings",
    href: "/admin/settings",
    icon: Settings,
    group: "Admin",
    keywords: ["commission", "keywords", "config"],
  },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const role = profile?.role;
  const roleCommands =
    role === "admin"
      ? ADMIN_COMMANDS
      : role === "doctor"
        ? DOCTOR_COMMANDS
        : role === "patient"
          ? PATIENT_COMMANDS
          : [];

  const roleHeading =
    role === "admin"
      ? "Admin Portal"
      : role === "doctor"
        ? "Doctor Portal"
        : "My Account";

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {PUBLIC_COMMANDS.map((cmd) => (
            <CommandItem
              key={cmd.href}
              onSelect={() => handleSelect(cmd.href)}
              keywords={cmd.keywords}
            >
              <cmd.icon className="mr-2 h-4 w-4" />
              {cmd.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {roleCommands.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={roleHeading}>
              {roleCommands.map((cmd) => (
                <CommandItem
                  key={cmd.href}
                  onSelect={() => handleSelect(cmd.href)}
                  keywords={cmd.keywords}
                >
                  <cmd.icon className="mr-2 h-4 w-4" />
                  {cmd.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
