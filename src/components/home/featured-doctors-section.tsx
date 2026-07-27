"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import type { FeaturedDoctor } from "@/actions/search";

interface FeaturedDoctorsSectionProps {
  doctors: FeaturedDoctor[];
}

export function FeaturedDoctorsSection({ doctors }: FeaturedDoctorsSectionProps) {
  const t = useTranslations("home");

  if (!doctors.length) return null;

  return (
    <section className="px-4 py-12 md:py-16">
      <div className="container mx-auto">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-bold md:text-3xl">
            {t("featured_doctors")}
          </h2>
          <Button variant="ghost" asChild>
            <Link href="/doctors" className="gap-1">
              {t("why_choose_cta")} <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {doctors.map((doctor) => {
            const initials = doctor.name
              .split(/\s+/)
              .map((p) => p[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();

            return (
              <Link key={doctor.slug} href={`/doctors/${doctor.slug}`}>
                <Card className="h-full transition-all hover:border-primary/40 hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <Avatar className="h-12 w-12 shrink-0">
                      {doctor.avatarUrl ? (
                        <AvatarImage src={doctor.avatarUrl} alt={doctor.name} />
                      ) : null}
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {initials || <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{doctor.name}</p>
                      {doctor.specialty ? (
                        <p className="truncate text-sm text-muted-foreground">
                          {doctor.specialty}
                        </p>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
