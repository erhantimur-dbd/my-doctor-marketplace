"use client";

import { Header } from "@/components/layout/dynamic-header";
import { Link, usePathname } from "@/i18n/navigation";
import { AdminSessionGuard } from "@/components/shared/session-timeout-guard";
import { DashboardMobileNav } from "@/components/layout/dashboard-mobile-nav";
import { adminSidebarGroups } from "@/lib/constants/sidebar-links";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isLinkActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AdminSessionGuard />
      <Header />
      <div className="container mx-auto flex flex-1 gap-8 px-4 py-8 pb-20 md:pb-8">
        <aside className="hidden w-56 shrink-0 md:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto">
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Admin Portal
              </span>
            </div>
            <nav className="space-y-1">
              {adminSidebarGroups.map((group, gi) => (
                <div key={gi} className={gi > 0 ? "pt-3" : undefined}>
                  {group.label && (
                    <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </p>
                  )}
                  {group.links.map((link) => {
                    const active = isLinkActive(link.href);
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <link.icon className="h-4 w-4 shrink-0" />
                        {link.label}
                      </Link>
                    );
                  })}
                </div>
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
