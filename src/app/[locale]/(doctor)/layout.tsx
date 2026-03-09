import { Suspense } from "react";
import { Header } from "@/components/layout/dynamic-header";
import { Link } from "@/i18n/navigation";
import { UnreadBadge } from "@/components/shared/unread-badge";
import { DoctorSessionGuard } from "@/components/shared/session-timeout-guard";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { LicenseBanner } from "@/components/shared/license-banner";
import { doctorSidebarLinks } from "@/lib/constants/sidebar-links";

export default function DoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <DoctorSessionGuard />
      <Header />
      <LicenseBanner />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8 pb-20 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <nav className="sticky top-24 space-y-1">
            {doctorSidebarLinks.map((link) => (
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
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DashboardMobileNav
        portal="doctor"
        messagesBadge={
          <Suspense fallback={null}>
            <UnreadBadge />
          </Suspense>
        }
      />
    </div>
  );
}
