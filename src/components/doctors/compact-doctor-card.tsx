"use client";

import { forwardRef } from "react";
import { useRouter } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Shield, User, FlaskConical, Clock } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { formatCurrency } from "@/lib/utils/currency";
import { cn, formatSpecialtyName } from "@/lib/utils";
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
  liveAvailable?: boolean;
}

export const CompactDoctorCard = forwardRef<HTMLDivElement, CompactDoctorCardProps>(
  function CompactDoctorCard({ doctor, locale = "en", isHighlighted, onHover, availability, liveAvailable }, ref) {
    const router = useRouter();
    const isTestingService = doctor.provider_type === "testing_service";
    const primarySpecialty = doctor.specialties?.find((s) => s.is_primary)
      ?.specialty || doctor.specialties?.[0]?.specialty;

    // Extract "next available" day and slots for availability snapshot
    const consultationType = availability?.consultationType || "in_person";
    const nextAvail = availability?.days?.[0];
    const nextDateLabel = nextAvail ? formatShortDateLabel(nextAvail.date) : null;
    const nextSlots = nextAvail?.slots?.slice(0, 6) ?? [];
    const remainingCount = (nextAvail?.slots?.length ?? 0) - nextSlots.length;

    return (
      <div
        ref={ref}
        onMouseEnter={() => onHover?.(doctor.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <Link href={`/doctors/${doctor.slug}`}>
          <Card
            className={cn(
              "transition-all hover:border-primary/50 hover:shadow-md",
              isHighlighted && "border-primary ring-2 ring-primary/20 shadow-md"
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
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-sm font-semibold truncate" style={{ maxWidth: '100%', display: 'block' }}>
                      {doctor.title} {doctor.profile.first_name} {doctor.profile.last_name}
                    </h4>
                    {doctor.verification_status === "verified" && (
                      <Shield className="h-3.5 w-3.5 shrink-0 text-green-600" />
                    )}
                    {liveAvailable && (
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm animate-badge-pulse shrink-0">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        Available Now
                      </span>
                    )}
                  </div>

                  {primarySpecialty && (
                    <p className="text-xs text-muted-foreground truncate">
                      {formatSpecialtyName(primarySpecialty.name_key)}
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

                  <div className="mt-2">
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

                  {/* Availability snapshot — time pills navigate to booking */}
                  {nextDateLabel && nextSlots.length > 0 && (
                    <div className="mt-1.5">
                      <p
                        className="text-xs text-green-600 flex items-center gap-1 mb-1"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <Clock className="h-3 w-3 shrink-0" />
                        Next: {nextDateLabel}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {nextSlots.map((slot) => (
                          <button
                            key={slot.start}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              router.push(
                                `/doctors/${doctor.slug}/book?date=${nextAvail!.date}&type=${consultationType}&time=${encodeURIComponent(slot.start)}`
                              );
                            }}
                            className="text-[11px] bg-green-50 text-green-700 rounded px-1.5 py-0.5 font-medium hover:bg-green-100 transition-colors cursor-pointer"
                          >
                            {formatSlotTime(slot.start)}
                          </button>
                        ))}
                        {remainingCount > 0 && (
                          <span
                            className="text-[11px] bg-muted text-muted-foreground rounded px-1.5 py-0.5"
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          >
                            +{remainingCount}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  }
);
