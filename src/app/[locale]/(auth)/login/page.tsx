import { AuthPage } from "@/components/auth/auth-page";
import { loadBookingAuthContext } from "@/lib/auth/booking-context";

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
