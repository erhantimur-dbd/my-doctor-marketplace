import type { Metadata } from "next";
import { AuthPage } from "@/components/auth/auth-page";
import { loadBookingAuthContext } from "@/lib/auth/booking-context";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in to MyDoctors360. Soft Launch is the Founding Doctor Programme — register and build your profile.",
};

interface LoginPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const sp = await searchParams;
  const redirectRaw = sp.redirect;
  const redirectTo = Array.isArray(redirectRaw) ? redirectRaw[0] : redirectRaw;
  const bookingContext = await loadBookingAuthContext(redirectTo);

  return (
    <AuthPage defaultTab="sign-in" bookingContext={bookingContext} />
  );
}
