import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import {
  Calendar,
  Users,
  Star,
  CreditCard,
  BarChart3,
  Settings,
  LayoutDashboard,
  User,
  FileText,
  Crown,
  Clock,
  MessageSquare,
  UserPlus,
} from "lucide-react";
import { UnreadBadge } from "@/components/shared/unread-badge";

const sidebarLinks = [
  { href: "/doctor-dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/doctor-dashboard/calendar", icon: Calendar, label: "Calendar" },
  { href: "/doctor-dashboard/bookings", icon: Clock, label: "Bookings" },
  { href: "/doctor-dashboard/patients", icon: Users, label: "Patients" },
  { href: "/doctor-dashboard/profile", icon: User, label: "Profile" },
  { href: "/doctor-dashboard/reviews", icon: Star, label: "Reviews" },
  { href: "/doctor-dashboard/payments", icon: CreditCard, label: "Payments" },
  { href: "/doctor-dashboard/analytics", icon: BarChart3, label: "Analytics" },
  { href: "/doctor-dashboard/policies", icon: FileText, label: "Policies" },
  {
    href: "/doctor-dashboard/subscription",
    icon: Crown,
    label: "Subscription",
  },
  {
    href: "/doctor-dashboard/referrals",
    icon: UserPlus,
    label: "Referrals",
  },
  {
    href: "/doctor-dashboard/messages",
    icon: MessageSquare,
    label: "Messages",
  },
  { href: "/doctor-dashboard/settings", icon: Settings, label: "Settings" },
];

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
                {link.href.endsWith("/messages") && (
                  <Suspense fallback={null}>
                    <UnreadBadge />
                  </Suspense>
                )}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
