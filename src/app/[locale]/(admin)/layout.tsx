import { Header } from "@/components/layout/dynamic-header";
import { Link } from "@/i18n/navigation";
import { AdminSessionGuard } from "@/components/shared/session-timeout-guard";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { adminSidebarLinks } from "@/lib/constants/sidebar-links";
import { ShieldCheck } from "lucide-react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <AdminSessionGuard />
      <Header />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8 pb-20 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24">
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Admin Portal
              </span>
            </div>
            <nav className="space-y-1">
              {adminSidebarLinks.map((link) => (
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DashboardMobileNav portal="admin" />
    </div>
  );
}
