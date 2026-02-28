import { Header } from "@/components/layout/header";
import { Link } from "@/i18n/navigation";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  Calendar,
  Star,
  DollarSign,
  Crown,
  Tag,
  Settings,
  ShieldCheck,
  HelpCircle,
} from "lucide-react";

const sidebarLinks = [
  { href: "/admin", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/doctors", icon: Stethoscope, label: "Doctors" },
  { href: "/admin/patients", icon: Users, label: "Patients" },
  { href: "/admin/bookings", icon: Calendar, label: "Bookings" },
  { href: "/admin/reviews", icon: Star, label: "Reviews" },
  { href: "/admin/revenue", icon: DollarSign, label: "Revenue" },
  { href: "/admin/subscriptions", icon: Crown, label: "Subscriptions" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/support", icon: HelpCircle, label: "Support" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Admin Portal
              </span>
            </div>
            <nav className="space-y-1">
              {sidebarLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  <link.icon className="h-4 w-4" />
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </aside>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
