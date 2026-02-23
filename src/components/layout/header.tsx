"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/providers/auth-provider";
import {
  Menu,
  User,
  LogOut,
  Calendar,
  Settings,
  Stethoscope,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "@/i18n/navigation";
import { useState } from "react";
import { LocaleSwitcher } from "./locale-switcher";

export function Header() {
  const t = useTranslations("nav");
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const navLinks = [
    { href: "/doctors", label: t("find_doctor") },
    { href: "/specialties", label: t("specialties") },
    { href: "/how-it-works", label: t("how_it_works") },
    { href: "/pricing", label: t("for_doctors") },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <Stethoscope className="h-7 w-7 text-primary" />
          <span className="text-xl font-bold tracking-tight">MyDoctor</span>
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

          {!loading && !user && (
            <div className="hidden items-center gap-2 md:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">{t("login")}</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">{t("register")}</Link>
              </Button>
            </div>
          )}

          {!loading && user && profile && (
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
            <SheetContent side="right" className="w-72">
              <nav className="mt-8 flex flex-col gap-4">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="text-base font-medium"
                  >
                    {link.label}
                  </Link>
                ))}
                {!user && (
                  <>
                    <hr className="my-2" />
                    <Button asChild>
                      <Link
                        href="/login"
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("login")}
                      </Link>
                    </Button>
                    <Button variant="outline" asChild>
                      <Link
                        href="/register"
                        onClick={() => setMobileOpen(false)}
                      >
                        {t("register")}
                      </Link>
                    </Button>
                  </>
                )}
                {user && profile && (
                  <>
                    <hr className="my-2" />
                    <Link
                      href={
                        profile.role === "doctor"
                          ? "/doctor-dashboard"
                          : profile.role === "admin"
                            ? "/admin"
                            : "/dashboard"
                      }
                      onClick={() => setMobileOpen(false)}
                      className="text-base font-medium"
                    >
                      {t("dashboard")}
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileOpen(false);
                      }}
                      className="text-left text-base font-medium text-destructive"
                    >
                      {t("logout")}
                    </button>
                  </>
                )}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
