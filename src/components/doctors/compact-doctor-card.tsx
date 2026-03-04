"use client";

import { forwardRef } from "react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Shield, User, FlaskConical, Clock } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { formatShortDateLabel, formatSlotTime } from "@/lib/utils/availability";
import type { DoctorMultiDayAvailability } from "@/actions/search";

interface CompactDoctorCardProps {
  doctor: {
    id: string;
    slug: string;
    title: string | null;
    bio: string | null;
    consultation_fee_cents: number;
    base_currency: string;
    avg_rating: number;
    total_reviews: number;
    is_featured: boolean;
    verification_status: string;
    consultation_types: string[];
    is_wheelchair_accessible?: boolean;
    provider_type?: string;
    languages: string[];
    profile: {
      first_name: string;
      last_name: string;
      avatar_url: string | null;
    };
    location: {
      city: string;
      country_code: string;
    } | null;
    specialties: {
      specialty: {
        name_key: string;
        slug: string;
      };
      is_primary: boolean;
    }[];
  };
  locale?: string;
  isHighlighted?: boolean;
  onHover?: (id: string | null) => void;
  availability?: DoctorMultiDayAvailability | null;
}

export const CompactDoctorCard = forwardRef<HTMLDivElement, CompactDoctorCardProps>(
  function CompactDoctorCard({ doctor, locale = "en", isHighlighted, onHover, availability }, ref) {
    const isTestingService = doctor.provider_type === "testing_service";
    const primarySpecialty = doctor.specialties?.find((s) => s.is_primary)
      ?.specialty || doctor.specialties?.[0]?.specialty;

    // Extract "next available" snippet from availability
    const nextAvail = availability?.days?.[0];
    const nextSlotLabel = nextAvail
      ? `${formatShortDateLabel(nextAvail.date)}, ${formatSlotTime(nextAvail.slots[0]?.start)}`
      : null;

    return (
      <div
        ref={ref}
        onMouseEnter={() => onHover?.(doctor.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <Link href={`/doctors/${doctor.slug}`}>
          <Card
            className={cn(
              "overflow-hidden border-t-[3px] border-t-transparent transition-all duration-200 hover:border-t-blue-500 hover:shadow-md hover:-translate-y-0.5 dark:hover:border-t-blue-400",
              isHighlighted && "border-t-blue-500 ring-2 ring-blue-500/20 shadow-md dark:border-t-blue-400 dark:ring-blue-400/20"
            )}
          >
            <CardContent className="p-3">
              <div className="flex gap-3">
                {/* Avatar */}
                <Avatar className={cn("h-10 w-10 shrink-0", isTestingService && "rounded-lg")}>
                  {doctor.profile.avatar_url ? (
                    <AvatarImage
                      src={doctor.profile.avatar_url}
                      alt={`${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`}
                    />
                  ) : null}
                  <AvatarFallback className={cn("text-sm", isTestingService && "rounded-lg bg-teal-50 dark:bg-teal-950/30")}>
                    {isTestingService ? (
                      <FlaskConical className="h-4 w-4 text-teal-600" />
                    ) : (
                      <User className="h-4 w-4" />
                    )}
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold truncate">
                      {doctor.title} {doctor.profile.first_name} {doctor.profile.last_name}
                    </h4>
                    {doctor.verification_status === "verified" && (
                      <Shield className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    )}
                  </div>

                  {primarySpecialty && (
                    <p className="text-xs text-muted-foreground truncate">
                      {primarySpecialty.name_key
                        .replace("specialty.", "")
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                  )}

                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {doctor.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {doctor.location.city}
                      </span>
                    )}
                    {doctor.avg_rating > 0 && (
                      <StarRating
                        rating={doctor.avg_rating}
                        totalReviews={doctor.total_reviews}
                        size="sm"
                        showCount
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <div>
                      <span className="text-sm font-bold">
                        {formatCurrency(
                          doctor.consultation_fee_cents,
                          doctor.base_currency,
                          locale
                        )}
                      </span>
                      <span className="text-[9px] text-muted-foreground/70 ml-0.5">
                        + fee
                      </span>
                    </div>
                    {nextSlotLabel && (
                      <span className="text-xs text-green-600 flex items-center gap-0.5">
                        <Clock className="h-3 w-3" />
                        {nextSlotLabel}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  }
);
