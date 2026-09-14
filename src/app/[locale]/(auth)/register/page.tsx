import { AuthPage } from "@/components/auth/auth-page";
import { loadBookingAuthContext } from "@/lib/auth/booking-context";

interface RegisterPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const sp = await searchParams;
  const redirectRaw = sp.redirect;
  const redirectTo = Array.isArray(redirectRaw) ? redirectRaw[0] : redirectRaw;
  const bookingContext = await loadBookingAuthContext(redirectTo);

  return (
    <AuthPage defaultTab="sign-up" bookingContext={bookingContext} />
  );
}
