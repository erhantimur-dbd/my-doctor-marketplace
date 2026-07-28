"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, Globe, MapPin, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { StarRating } from "@/components/shared/star-rating";
import type { FeaturedDoctor } from "@/actions/search";

interface FeaturedDoctorsSectionProps {
  doctors: FeaturedDoctor[];
}

export function FeaturedDoctorsSection({ doctors }: FeaturedDoctorsSectionProps) {
  const t = useTranslations("home");
  const tDoctor = useTranslations("doctor");

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
                  <CardContent className="flex h-full flex-col gap-3 p-4">
                    {/* Avatar + name/specialty */}
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar className="h-12 w-12 shrink-0">
                        {doctor.avatarUrl ? (
                          <AvatarImage src={doctor.avatarUrl} alt={doctor.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {initials || <User className="h-5 w-5" />}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight">
                          {doctor.name}
                        </p>
                        {doctor.specialty ? (
                          <p className="truncate text-sm text-muted-foreground">
                            {doctor.specialty}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {/* Star rating */}
                    {doctor.totalReviews > 0 ? (
                      <StarRating
                        rating={doctor.avgRating}
                        totalReviews={doctor.totalReviews}
                        size="sm"
                        showCount
                      />
                    ) : doctor.avgRating > 0 ? (
                      <StarRating rating={doctor.avgRating} size="sm" />
                    ) : null}

                    {/* Location · years of experience */}
                    {(doctor.city ||
                      (doctor.yearsOfExperience != null &&
                        doctor.yearsOfExperience > 0)) && (
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                        {doctor.city ? (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <MapPin className="h-3 w-3 shrink-0" aria-hidden />
                            <span className="truncate">{doctor.city}</span>
                          </span>
                        ) : null}
                        {doctor.city &&
                        doctor.yearsOfExperience != null &&
                        doctor.yearsOfExperience > 0 ? (
                          <span className="text-muted-foreground/50" aria-hidden>
                            ·
                          </span>
                        ) : null}
                        {doctor.yearsOfExperience != null &&
                        doctor.yearsOfExperience > 0 ? (
                          <span className="truncate">
                            {tDoctor("years_experience", {
                              count: doctor.yearsOfExperience,
                            })}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Languages spoken */}
                    {doctor.languages && doctor.languages.length > 0 ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Globe className="h-3 w-3 shrink-0" aria-hidden />
                        <span className="truncate">
                          {(() => {
                            const codes = doctor.languages
                              .slice(0, 3)
                              .map((c) => c.toUpperCase());
                            const remaining = doctor.languages.length - 3;
                            return remaining > 0
                              ? `${codes.join(", ")} +${remaining}`
                              : codes.join(", ");
                          })()}
                        </span>
                      </div>
                    ) : null}

                    {/* Endorsement pills */}
                    {doctor.endorsements && doctor.endorsements.length > 0 ? (
                      <div className="mt-auto flex flex-wrap gap-1.5">
                        {doctor.endorsements.map((e) => (
                          <span
                            key={e.label}
                            className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
                          >
                            ★ {e.label}
                            <span className="text-amber-600/80 dark:text-amber-300/80">
                              · {e.count}
                            </span>
                          </span>
                        ))}
                      </div>
                    ) : null}
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
