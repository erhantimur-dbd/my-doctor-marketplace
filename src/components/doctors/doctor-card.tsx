"use client";

import { forwardRef } from "react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Clock, Star, MapPin, Shield, Video, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { formatDateLabel, formatSlotTime } from "@/lib/utils/availability";
import type { DoctorNextAvailability } from "@/actions/search";

interface DoctorCardProps {
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
  availability?: DoctorNextAvailability | null;
}

export const DoctorCard = forwardRef<HTMLDivElement, DoctorCardProps>(
  function DoctorCard({ doctor, locale = "en", isHighlighted, onHover, availability }, ref) {
    const primarySpecialty = doctor.specialties?.find((s) => s.is_primary)
      ?.specialty || doctor.specialties?.[0]?.specialty;

    return (
      <div
        ref={ref}
        onMouseEnter={() => onHover?.(doctor.id)}
        onMouseLeave={() => onHover?.(null)}
      >
        <Link href={`/doctors/${doctor.slug}`}>
          <Card
            className={cn(
              "group h-full transition-all hover:border-primary/50 hover:shadow-lg",
              isHighlighted && "border-primary ring-2 ring-primary/20 shadow-lg"
            )}
          >
            <CardContent className="p-5">
              <div className="flex gap-4">
                {/* Avatar */}
                <Avatar className="h-16 w-16 shrink-0">
                  {doctor.profile.avatar_url ? (
                    <AvatarImage
                      src={doctor.profile.avatar_url}
                      alt={`${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`}
                    />
                  ) : null}
                  <AvatarFallback className="text-lg">
                    <User className="h-6 w-6" />
                  </AvatarFallback>
                </Avatar>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold group-hover:text-primary">
                        {doctor.title} {doctor.profile.first_name}{" "}
                        {doctor.profile.last_name}
                      </h3>
                      {primarySpecialty && (
                        <p className="text-sm text-muted-foreground">
                          {primarySpecialty.name_key
                            .replace("specialty.", "")
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      )}
                    </div>
                    {doctor.is_featured && (
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        Featured
                      </Badge>
                    )}
                  </div>

                  {/* Location */}
                  {doctor.location && (
                    <div className="mt-1.5 flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" />
                      <span>
                        {doctor.location.city}, {doctor.location.country_code}
                      </span>
                    </div>
                  )}

                  {/* Rating & Reviews */}
                  <div className="mt-2 flex items-center gap-3">
                    {doctor.avg_rating > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-sm font-medium">
                          {Number(doctor.avg_rating).toFixed(1)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({doctor.total_reviews})
                        </span>
                      </div>
                    )}
                    {doctor.verification_status === "verified" && (
                      <div className="flex items-center gap-1 text-green-600">
                        <Shield className="h-3.5 w-3.5" />
                        <span className="text-xs">Verified</span>
                      </div>
                    )}
                    {doctor.consultation_types?.includes("video") && (
                      <div className="flex items-center gap-1 text-purple-600">
                        <Video className="h-3.5 w-3.5" />
                        <span className="text-xs">Video</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Next Availability */}
              {availability !== undefined && (
                <div className="mt-3 border-t pt-3">
                  {availability && availability.slots.length > 0 ? (
                    <div>
                      <div className="mb-1.5 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-green-600" />
                        <span className="text-xs font-medium text-green-700">
                          {formatDateLabel(availability.date)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availability.slots.slice(0, 4).map((slot) => (
                          <Link
                            key={slot.start}
                            href={`/doctors/${doctor.slug}/book?date=${availability.date}&type=${availability.consultationType || "in_person"}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center rounded-md border border-primary/20 bg-primary/5 px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                          >
                            {formatSlotTime(slot.start)}
                          </Link>
                        ))}
                        {availability.slots.length > 4 && (
                          <span className="inline-flex items-center px-1 py-1 text-xs text-muted-foreground">
                            +{availability.slots.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No availability in next 14 days
                    </p>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <div>
                  <span className="text-lg font-bold">
                    {formatCurrency(
                      doctor.consultation_fee_cents,
                      doctor.base_currency,
                      locale
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {" "}
                    / session
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="group-hover:bg-primary group-hover:text-primary-foreground"
                >
                  Book Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    );
  }
);
