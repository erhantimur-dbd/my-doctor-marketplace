import { Suspense } from "react";
import { Header } from "@/components/layout/dynamic-header";
import { Link } from "@/i18n/navigation";
import { UnreadBadge } from "@/components/shared/unread-badge";
import { PatientSessionGuard } from "@/components/shared/session-timeout-guard";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { patientSidebarLinks } from "@/lib/constants/sidebar-links";

export default function PatientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <PatientSessionGuard />
      <Header />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8 pb-20 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {patientSidebarLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <link.icon className="h-4 w-4" />
                {link.label}
                {link.hasUnreadBadge && (
                  <Suspense fallback={null}>
                    <UnreadBadge />
                  </Suspense>
                )}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-hidden">{children}</main>
      </div>
      <DashboardMobileNav
        portal="patient"
        messagesBadge={
          <Suspense fallback={null}>
            <UnreadBadge />
          </Suspense>
        }
      />
    </div>
  );
}
