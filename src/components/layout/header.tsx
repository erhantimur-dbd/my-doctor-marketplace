"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import {
  Menu,
  User,
  LogOut,
  Calendar,
  Settings,
  Stethoscope,
  Search,
  HelpCircle,
  Briefcase,
  Shield,
  LayoutDashboard,
  UserCircle,
} from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { LocaleSwitcher } from "./locale-switcher";
import { logout } from "@/actions/auth";
import { Logo } from "@/components/brand/logo";

export function Header() {
  const t = useTranslations("nav");
  const tHome = useTranslations("home");
  const { user, profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    // Use server action — avoids client-side NavigatorLock contention
    await logout(locale);
  };

  const isPatient = profile?.role === "patient";

  const navLinks = [
    { href: "/doctors", label: t("find_doctor"), icon: Search, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
    { href: "/specialties", label: t("specialties"), icon: Stethoscope, iconBg: "bg-teal-50", iconColor: "text-teal-600" },
    { href: "/how-it-works", label: t("how_it_works"), icon: HelpCircle, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
    // Hide "For Doctors" when a patient is logged in to keep focus on patient experience
    ...(!isPatient ? [{ href: "/pricing", label: t("for_doctors"), icon: Briefcase, iconBg: "bg-emerald-50", iconColor: "text-emerald-600" }] : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Logo className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">MyDoctors360</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === link.href
                  ? "text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LocaleSwitcher />

          {!user && (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("register")}</Link>
              </Button>
            </div>
          )}

          {user && profile && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden gap-2 md:flex"
                >
                  <User className="h-4 w-4" />
                  <span>
                    {profile.first_name} {profile.last_name}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {profile.role === "patient" && (
                  <>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard">
                        <Calendar className="mr-2 h-4 w-4" />
                        {t("my_bookings")}
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard/settings">
                        <Settings className="mr-2 h-4 w-4" />
                        {t("my_profile")}
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                {profile.role === "doctor" && (
                  <DropdownMenuItem asChild>
                    <Link href="/doctor-dashboard">
                      <Calendar className="mr-2 h-4 w-4" />
                      {t("dashboard")}
                    </Link>
                  </DropdownMenuItem>
                )}
                {profile.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">
                      <Settings className="mr-2 h-4 w-4" />
                      {t("dashboard")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  {t("logout")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Mobile hamburger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex w-80 flex-col gap-0 p-0">
              {/* Branded Header */}
              <SheetHeader className="border-b bg-muted/30 px-6 pb-4 pt-6">
                <SheetTitle className="flex items-center gap-2.5">
                  <Logo className="h-6 w-6 text-primary" />
                  <span className="text-lg font-bold tracking-tight">MyDoctors360</span>
                </SheetTitle>
                <SheetDescription className="text-xs">
                  Premium private healthcare marketplace
                </SheetDescription>
              </SheetHeader>

              {/* Scrollable Navigation */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                {/* Main nav links */}
                <div className="space-y-1">
                  {navLinks.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-primary/5 text-primary"
                            : "text-foreground hover:bg-muted/50"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${link.iconBg}`}
                        >
                          <Icon
                            className={`h-[18px] w-[18px] ${link.iconColor}`}
                          />
                        </div>
                        <span>{link.label}</span>
                        {isActive && (
                          <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Authenticated user section */}
                {user && profile && (
                  <>
                    <div className="my-3 px-3">
                      <div className="h-px bg-border" />
                    </div>

                    {/* User identity card */}
                    <div className="mx-3 mb-3 flex items-center gap-3 rounded-lg bg-muted/40 px-3 py-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <span className="text-sm font-semibold">
                          {profile.first_name?.[0]}
                          {profile.last_name?.[0]}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {profile.first_name} {profile.last_name}
                        </p>
                        <Badge variant="secondary" className="mt-0.5 text-[10px] capitalize">
                          {profile.role}
                        </Badge>
                      </div>
                    </div>

                    {/* Role-specific links */}
                    <div className="space-y-1">
                      {profile.role === "patient" && (
                        <>
                          <Link
                            href="/dashboard"
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                              pathname === "/dashboard"
                                ? "bg-primary/5 text-primary"
                                : "text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              pathname === "/dashboard" ? "bg-primary/10" : "bg-violet-50"
                            }`}>
                              <Calendar className={`h-[18px] w-[18px] ${
                                pathname === "/dashboard" ? "text-primary" : "text-violet-600"
                              }`} />
                            </div>
                            <span>{t("my_bookings")}</span>
                            {pathname === "/dashboard" && (
                              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </Link>
                          <Link
                            href="/dashboard/settings"
                            onClick={() => setMobileOpen(false)}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                              pathname === "/dashboard/settings"
                                ? "bg-primary/5 text-primary"
                                : "text-foreground hover:bg-muted/50"
                            }`}
                          >
                            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                              pathname === "/dashboard/settings" ? "bg-primary/10" : "bg-rose-50"
                            }`}>
                              <UserCircle className={`h-[18px] w-[18px] ${
                                pathname === "/dashboard/settings" ? "text-primary" : "text-rose-600"
                              }`} />
                            </div>
                            <span>{t("my_profile")}</span>
                            {pathname === "/dashboard/settings" && (
                              <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                            )}
                          </Link>
                        </>
                      )}
                      {profile.role === "doctor" && (
                        <Link
                          href="/doctor-dashboard"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            pathname.startsWith("/doctor-dashboard")
                              ? "bg-primary/5 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            pathname.startsWith("/doctor-dashboard") ? "bg-primary/10" : "bg-violet-50"
                          }`}>
                            <LayoutDashboard className={`h-[18px] w-[18px] ${
                              pathname.startsWith("/doctor-dashboard") ? "text-primary" : "text-violet-600"
                            }`} />
                          </div>
                          <span>{t("dashboard")}</span>
                        </Link>
                      )}
                      {profile.role === "admin" && (
                        <Link
                          href="/admin"
                          onClick={() => setMobileOpen(false)}
                          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                            pathname.startsWith("/admin")
                              ? "bg-primary/5 text-primary"
                              : "text-foreground hover:bg-muted/50"
                          }`}
                        >
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                            pathname.startsWith("/admin") ? "bg-primary/10" : "bg-violet-50"
                          }`}>
                            <Settings className={`h-[18px] w-[18px] ${
                              pathname.startsWith("/admin") ? "text-primary" : "text-violet-600"
                            }`} />
                          </div>
                          <span>{t("dashboard")}</span>
                        </Link>
                      )}

                      {/* Logout */}
                      <button
                        onClick={() => {
                          handleLogout();
                          setMobileOpen(false);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
                          <LogOut className="h-[18px] w-[18px] text-red-500" />
                        </div>
                        <span>{t("logout")}</span>
                      </button>
                    </div>
                  </>
                )}

                {/* Unauthenticated auth buttons */}
                {!user && (
                  <>
                    <div className="my-3 px-3">
                      <div className="h-px bg-border" />
                    </div>
                    <div className="space-y-2 px-3">
                      <Button className="w-full" size="lg" asChild>
                        <Link href="/login" onClick={() => setMobileOpen(false)}>
                          <User className="mr-2 h-4 w-4" />
                          {t("login")}
                        </Link>
                      </Button>
                      <Button className="w-full" size="lg" variant="outline" asChild>
                        <Link href="/register" onClick={() => setMobileOpen(false)}>
                          {t("register")}
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </nav>

              {/* Trust Footer */}
              <SheetFooter className="border-t px-6 py-4">
                <div className="flex w-full items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="h-3.5 w-3.5 text-emerald-600" />
                  <span>{tHome("trusted_by")}</span>
                </div>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
