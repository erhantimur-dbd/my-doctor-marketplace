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
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/providers/auth-provider";

interface CommandItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  keywords?: string[];
}

const PUBLIC_COMMANDS: CommandItem[] = [
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

const PATIENT_COMMANDS: CommandItem[] = [
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

const DOCTOR_COMMANDS: CommandItem[] = [
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

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { profile } = useAuth();

  // Listen for Ctrl/Cmd + K
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
    role === "doctor"
      ? DOCTOR_COMMANDS
      : role === "patient"
        ? PATIENT_COMMANDS
        : [];

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
            <CommandGroup heading={role === "doctor" ? "Doctor Portal" : "My Account"}>
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
