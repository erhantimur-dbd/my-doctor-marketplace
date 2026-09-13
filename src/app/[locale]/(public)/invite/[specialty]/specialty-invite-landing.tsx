import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { getSpecialtyMeta } from "@/lib/constants/specialties";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import {
  foundingRegisterHref,
  type SpecialtyInviteCopy,
} from "@/lib/constants/specialty-invites";
import { FOUNDING_PROGRAMME_MAX_SPOTS } from "@/lib/constants/company";
import { formatSpecialtyName } from "@/lib/utils";
import { SpecialtyIcon } from "@/components/marketing/specialty-icon";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Gift,
  Users,
} from "lucide-react";

const FOUNDING_CALLOUTS = [
  {
    icon: Gift,
    title: "Founding Free — £0",
    description:
      "Founding-tier benefits at £0 — no card required. Build your profile before patient launch.",
  },
  {
    icon: Users,
    title: `First ${FOUNDING_PROGRAMME_MAX_SPOTS} founding perks`,
    description:
      "The first 100 doctors keep founding-tier benefits. Sales can send this page instead of a generic founding link.",
  },
  {
    icon: Calendar,
    title: "Practice tools, when you enable them",
    description:
      "Booking, calendar, video, and payments software for your own list — not a live patient marketplace yet.",
  },
  {
    icon: CreditCard,
    title: "You stay clinically independent",
    description:
      "MyDoctors360 is booking, video, and payments software. We are not CQC-registered and do not provide or arrange care.",
  },
];

export function SpecialtyInviteLanding({
  slug,
  copy,
}: {
  slug: string;
  copy: SpecialtyInviteCopy;
}) {
  const meta = getSpecialtyMeta(slug);
  const color = getSpecialtyColor(slug);
  const specialtyName = meta ? formatSpecialtyName(meta.nameKey) : slug;
  const registerHref = foundingRegisterHref(slug);

  return (
    <>
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <div
            className={`mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-2xl ${color.bg}`}
          >
            <SpecialtyIcon slug={slug} className={`h-10 w-10 ${color.text}`} />
          </div>
          <Badge className="mb-4 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">
            Founding Doctor Invite · {specialtyName}
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            {copy.headline}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            {copy.subhead}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button className="rounded-full" size="lg" asChild>
              <Link href={registerHref}>
                Claim founding spot
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button className="rounded-full" size="lg" variant="outline" asChild>
              <Link href="/pricing">View pricing</Link>
            </Button>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-xs text-muted-foreground">
            MyDoctors360 is a marketplace and practice toolkit for independent
            clinicians. We do not provide or arrange medical or dental care.
          </p>
        </div>
      </section>

      <section className="border-b bg-background px-4 py-12 md:py-16">
        <div className="container mx-auto max-w-3xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Why {specialtyName.toLowerCase()} practices join
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Marketplace software for independent clinicians — not care delivery
            and not CQC.
          </p>
          <ul className="mt-8 space-y-3">
            {copy.usps.map((usp) => (
              <li
                key={usp}
                className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-sm"
              >
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm leading-relaxed">{usp}</span>
              </li>
            ))}
          </ul>
          {copy.clinicVsSolo && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              {copy.clinicVsSolo}
            </p>
          )}
        </div>
      </section>

      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold md:text-3xl">
            Founding Doctor programme
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
            Same Founding Free register as our other doctor CTAs — this page
            just preselects {specialtyName.toLowerCase()}.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FOUNDING_CALLOUTS.map((item) => {
              const CalloutIcon = item.icon;
              return (
                <Card key={item.title}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <CalloutIcon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 md:py-24">
        <div className="container mx-auto">
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-primary via-primary/90 to-primary/80">
            <CardContent className="p-8 md:p-14">
              <div className="mx-auto max-w-2xl text-center text-white">
                <h2 className="text-2xl font-bold md:text-3xl">
                  Ready to list your {specialtyName.toLowerCase()} practice?
                </h2>
                <p className="mt-3 text-white/85">
                  Register on Founding Free. No card required. Your specialty
                  is preselected as {specialtyName} — build the profile before
                  patient discovery opens.
                </p>
                <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button
                    className="rounded-full bg-white text-primary hover:bg-white/90"
                    size="lg"
                    asChild
                  >
                    <Link href={registerHref}>
                      Register as founding doctor
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    className="rounded-full border-white/40 bg-transparent text-white hover:bg-white/10"
                    size="lg"
                    variant="outline"
                    asChild
                  >
                    <Link href="/pricing">Compare plans</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}
