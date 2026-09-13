import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HeroSpecialtyIcons } from "@/components/shared/hero-specialty-icons";
import { getMedicalSpecialties } from "@/lib/constants/specialties";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";
import { getSpecialtyInvite } from "@/lib/constants/specialty-invites";
import { formatSpecialtyName } from "@/lib/utils";
import { SpecialtyIcon } from "@/components/marketing/specialty-icon";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import { generateMetadata as seoMeta } from "@/lib/seo/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return seoMeta({
    title: "Founding Doctor Invites by Specialty",
    description:
      "Specialty-specific founding doctor invite pages for independent clinicians — dentistry, cardiology, GP, and more.",
    path: "/en/invite",
  });
}

export default function SpecialtyInviteIndexPage() {
  const specialties = getMedicalSpecialties();

  return (
    <>
      <section className="relative bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <HeroSpecialtyIcons />
        <div className="relative container mx-auto text-center">
          <Badge className="mb-4 border-primary/20 bg-primary/10 text-primary hover:bg-primary/15">
            Founding Doctor Invites
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Invite a practice by specialty
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Send a specialty landing page instead of a generic founding link.
            Each page explains founding tools — booking, calendar, video, and
            payments software — and lands on Founding Free register. No card
            required.
          </p>
        </div>
      </section>

      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto max-w-6xl">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {specialties.map((spec) => {
              const color = getSpecialtyColor(spec.slug);
              const name = formatSpecialtyName(spec.nameKey);
              const copy = getSpecialtyInvite(spec.slug);
              return (
                <Card
                  key={spec.slug}
                  className={`group transition-shadow hover:shadow-md ${color.border}`}
                >
                  <CardContent className="p-5">
                    <div
                      className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${color.bg}`}
                    >
                      <SpecialtyIcon slug={spec.slug} className={color.text} />
                    </div>
                    <h2 className="font-semibold">{name}</h2>
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {copy?.subhead ?? spec.description}
                    </p>
                    <Button
                      className="mt-4 rounded-full"
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <Link href={`/invite/${spec.slug}`}>
                        Open {name} invite
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>
    </>
  );
}
