import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import {
  Calendar,
  Heart,
  HelpCircle,
  MessageSquare,
  Settings,
  Star,
  LayoutDashboard,
} from "lucide-react";
import { UnreadBadge } from "@/components/shared/unread-badge";

const sidebarLinks = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/dashboard/bookings", icon: Calendar, label: "Bookings" },
  { href: "/dashboard/favorites", icon: Heart, label: "Saved Doctors" },
  { href: "/dashboard/reviews", icon: Star, label: "My Reviews" },
  { href: "/dashboard/messages", icon: MessageSquare, label: "Messages" },
  { href: "/dashboard/settings", icon: Settings, label: "Settings" },
  { href: "/dashboard/support", icon: HelpCircle, label: "Support" },
];

export default function PatientLayout({
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
                {link.href === "/dashboard/messages" && (
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
