"use client";

import { useState } from "react";
import { usePathname, Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MoreHorizontal, ShieldCheck, LayoutDashboard } from "lucide-react";
import {
  doctorSidebarLinks,
  doctorSidebarGroups,
  patientSidebarLinks,
  adminSidebarLinks,
  type SidebarLink,
  type SidebarGroup,
} from "@/lib/constants/sidebar-links";

type Portal = "doctor" | "patient" | "admin";

const portalConfig: Record<
  Portal,
  {
    links: SidebarLink[];
    groups?: SidebarGroup[];
    quickHrefs: string[];
    title: string;
    rootPath: string;
  }
> = {
  doctor: {
    links: doctorSidebarLinks,
    groups: doctorSidebarGroups,
    quickHrefs: [
      "/doctor-dashboard",
      "/doctor-dashboard/calendar",
      "/doctor-dashboard/bookings",
      "/doctor-dashboard/messages",
    ],
    title: "Doctor Dashboard",
    rootPath: "/doctor-dashboard",
  },
  patient: {
    links: patientSidebarLinks,
    quickHrefs: [
      "/dashboard",
      "/dashboard/bookings",
      "/dashboard/messages",
      "/dashboard/settings",
    ],
    title: "My Dashboard",
    rootPath: "/dashboard",
  },
  admin: {
    links: adminSidebarLinks,
    quickHrefs: [
      "/admin",
      "/admin/doctors",
      "/admin/bookings",
      "/admin/revenue",
    ],
    title: "Admin Portal",
    rootPath: "/admin",
  },
};

interface DashboardMobileNavProps {
  portal: Portal;
  /** Server-rendered UnreadBadge passed from layout */
  messagesBadge?: React.ReactNode;
}

export function DashboardMobileNav({
  portal,
  messagesBadge,
}: DashboardMobileNavProps) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const pathname = usePathname();

  const config = portalConfig[portal];
  const { links, groups, quickHrefs, title, rootPath } = config;
  const quickLinks = links.filter((l) => quickHrefs.includes(l.href));

  const PortalIcon = portal === "admin" ? ShieldCheck : LayoutDashboard;

  const isLinkActive = (href: string) => {
    // Exact match for root dashboard routes
    if (href === rootPath) return pathname === rootPath;
    // startsWith for sub-routes
    return pathname.startsWith(href);
  };

  const renderLink = (link: SidebarLink) => {
    const Icon = link.icon;
    const active = isLinkActive(link.href);

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => setSheetOpen(false)}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{link.label}</span>
        {link.hasUnreadBadge && messagesBadge}
      </Link>
    );
  };

  return (
    <>
      {/* Fixed bottom tab bar — mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
        <nav
          className="mx-auto flex max-w-lg items-center justify-around"
          style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
        >
          {quickLinks.map((link) => {
            const Icon = link.icon;
            const active = isLinkActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 px-3 pb-1 pt-2 text-[11px] font-medium transition-colors",
                  active
                    ? "text-primary"
                    : "text-muted-foreground active:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="truncate">{link.label}</span>
                {link.hasUnreadBadge && messagesBadge && (
                  <span className="absolute right-1.5 top-1.5">
                    <span className="block h-2 w-2 rounded-full bg-destructive" />
                  </span>
                )}
              </Link>
            );
          })}

          {/* "More" button to open full nav sheet */}
          <button
            onClick={() => setSheetOpen(true)}
            className={cn(
              "flex flex-col items-center gap-0.5 px-3 pb-1 pt-2 text-[11px] font-medium transition-colors",
              sheetOpen
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </nav>
      </div>

      {/* Full navigation sheet — slides from left */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 p-0">
          {/* Portal header */}
          <SheetHeader className="border-b px-5 pb-3 pt-5">
            <SheetTitle className="flex items-center gap-2 text-base">
              <PortalIcon className="h-5 w-5 text-primary" />
              {title}
            </SheetTitle>
            <SheetDescription className="sr-only">
              Dashboard navigation menu
            </SheetDescription>
          </SheetHeader>

          {/* Scrollable nav links */}
          <ScrollArea className="flex-1">
            <nav className="px-3 py-3">
              {groups ? (
                // Render grouped links with section headers
                groups.map((group, gi) => (
                  <div key={gi}>
                    {gi > 0 && <div className="mx-3 my-2 h-px bg-border" />}
                    {group.label && (
                      <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {group.label}
                      </p>
                    )}
                    {group.links.map(renderLink)}
                  </div>
                ))
              ) : (
                // Render flat list
                links.map(renderLink)
              )}
            </nav>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
