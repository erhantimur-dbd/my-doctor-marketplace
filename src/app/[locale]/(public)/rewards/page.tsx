import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  Trophy,
  Star,
  Gift,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

export const metadata = {
  title: "Rewards Programme | MyDoctors360",
  description:
    "Earn cashback on every booking with MyDoctors360 Rewards. Bronze, Silver, and Gold tiers with up to 5% cashback.",
};

export default function RewardsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      {/* Hero Section */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">MyDoctors360 Rewards</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Earn rewards every time you book. The more you use MyDoctors360, the
          more you save.
        </p>
      </div>

      {/* Tier Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Bronze */}
        <Card className="border-amber-300 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <span className="text-4xl">&#129353;</span>
              <h2 className="mt-2 text-xl font-bold text-amber-800 dark:text-amber-400">
                Bronze
              </h2>
              <p className="text-sm text-amber-700 dark:text-amber-500">
                Starting Tier
              </p>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-amber-800 dark:text-amber-400">
                2%
              </span>
              <p className="text-sm text-muted-foreground">
                cashback on every booking
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-600" />
                Access to wallet credits
              </li>
              <li className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-600" />
                Referral rewards
              </li>
            </ul>
            <p className="text-center text-xs text-muted-foreground">
              0 bookings required
            </p>
          </CardContent>
        </Card>

        {/* Silver */}
        <Card className="border-slate-400 bg-slate-50/50 dark:bg-slate-900/40">
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <span className="text-4xl">&#129352;</span>
              <h2 className="mt-2 text-xl font-bold text-slate-700 dark:text-slate-300">
                Silver
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Regular Patient
              </p>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-slate-700 dark:text-slate-300">
                3%
              </span>
              <p className="text-sm text-muted-foreground">
                cashback on every booking
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-slate-500" />
                Everything in Bronze
              </li>
              <li className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Priority support
              </li>
            </ul>
            <p className="text-center text-xs text-muted-foreground">
              5 bookings required
            </p>
          </CardContent>
        </Card>

        {/* Gold */}
        <Card className="relative border-yellow-400 bg-yellow-50/50 dark:bg-yellow-950/20">
          <Badge className="absolute -top-2 right-4 bg-yellow-500 text-white hover:bg-yellow-600">
            Best Value
          </Badge>
          <CardContent className="space-y-4 p-6">
            <div className="text-center">
              <span className="text-4xl">&#129351;</span>
              <h2 className="mt-2 text-xl font-bold text-yellow-700 dark:text-yellow-400">
                Gold
              </h2>
              <p className="text-sm text-yellow-600 dark:text-yellow-500">
                Loyal Patient
              </p>
            </div>
            <div className="text-center">
              <span className="text-3xl font-bold text-yellow-700 dark:text-yellow-400">
                5%
              </span>
              <p className="text-sm text-muted-foreground">
                cashback on every booking
              </p>
            </div>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-600" />
                Everything in Silver
              </li>
              <li className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                Exclusive promotions
              </li>
              <li className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-yellow-600" />
                Early access to new features
              </li>
            </ul>
            <p className="text-center text-xs text-muted-foreground">
              15 bookings required
            </p>
          </CardContent>
        </Card>
      </div>

      {/* How It Works */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">How It Works</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                1
              </div>
              <div>
                <h3 className="font-semibold">Book an appointment</h3>
                <p className="text-sm text-muted-foreground">
                  Choose any doctor on MyDoctors360
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                2
              </div>
              <div>
                <h3 className="font-semibold">Complete your visit</h3>
                <p className="text-sm text-muted-foreground">
                  Attend your consultation (in-person or video)
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                3
              </div>
              <div>
                <h3 className="font-semibold">Earn cashback</h3>
                <p className="text-sm text-muted-foreground">
                  Cashback is automatically credited to your wallet
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                4
              </div>
              <div>
                <h3 className="font-semibold">Use your credits</h3>
                <p className="text-sm text-muted-foreground">
                  Wallet balance is applied to your next booking
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ways to Earn */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">Ways to Earn</h2>
          <div className="space-y-6">
            <div className="flex gap-4">
              <Trophy className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Booking cashback</h3>
                <p className="text-sm text-muted-foreground">
                  Earn your tier&apos;s percentage back on every completed
                  booking
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Users className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Refer a friend</h3>
                <p className="text-sm text-muted-foreground">
                  Both you and your friend receive wallet credit when they
                  complete their first booking
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Gift className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Gift cards</h3>
                <p className="text-sm text-muted-foreground">
                  Purchase or redeem gift cards that add directly to your wallet
                </p>
              </div>
            </div>
            <div className="flex gap-4">
              <Sparkles className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">Promotions</h3>
                <p className="text-sm text-muted-foreground">
                  Watch for seasonal promotions and bonus credit events
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* FAQ */}
      <Card>
        <CardContent className="p-6 sm:p-8">
          <h2 className="mb-6 text-2xl font-bold">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold">When do I earn cashback?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Cashback is credited to your wallet automatically when your
                booking is confirmed and payment is processed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">
                How do I use my wallet credits?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Credits are automatically applied to your next booking, invoice,
                or treatment plan payment. No action needed.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">Do my rewards expire?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Wallet credits do not expire as long as your account is active.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">
                Can I move between tiers?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Yes! Your tier is based on your total completed bookings. Once
                you reach a new tier, you stay at that level.
              </p>
            </div>
            <div>
              <h3 className="font-semibold">
                Is there a Platinum tier coming?
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                We&apos;re always looking to reward our most loyal patients. Stay
                tuned for exciting updates!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA Section */}
      <div className="text-center">
        <h2 className="text-2xl font-bold">Ready to start earning?</h2>
        <div className="mt-4">
          <Button asChild size="lg">
            <Link href="/doctors">
              Find a Doctor
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
