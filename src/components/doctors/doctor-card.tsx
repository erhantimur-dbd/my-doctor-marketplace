"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, MapPin, Shield, Video, User, Accessibility, CalendarDays, FlaskConical, Loader2, ChevronLeft, ChevronRight, Globe, Quote } from "lucide-react";
import { StarRating } from "@/components/shared/star-rating";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import { formatShortDateLabel, formatSlotTime } from "@/lib/utils/availability";
import { AvailabilityCalendar } from "@/components/booking/availability-calendar";
import { getMultiDayAvailabilityBatch } from "@/actions/search";
import type { DoctorMultiDayAvailability } from "@/actions/search";
import { getFeaturedReview } from "@/actions/reviews";

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
  matchScore?: number;
  matchReasons?: string[];
}

export const DoctorCard = forwardRef<HTMLDivElement, DoctorCardProps>(
  function DoctorCard({ doctor, locale = "en", isHighlighted, onHover, availability, matchScore, matchReasons }, ref) {
    const router = useRouter();
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [showFullAvailability, setShowFullAvailability] = useState(false);
    const [activeConsultationType, setActiveConsultationType] = useState(
      availability?.consultationType || "in_person"
    );
    const [cardAvailability, setCardAvailability] = useState(availability);
    const [loadingAvailability, setLoadingAvailability] = useState(false);
    const dayScrollRef = useRef<HTMLDivElement>(null);

    // Featured 5-star review for the modal
    const [featuredReview, setFeaturedReview] = useState<{
      comment: string;
      firstName: string;
      lastInitial: string;
    } | null>(null);
    useEffect(() => {
      if (showFullAvailability && doctor.total_reviews > 0 && !featuredReview) {
        getFeaturedReview(doctor.id).then((review) => {
          if (review) setFeaturedReview(review);
        });
      }
    }, [showFullAvailability, doctor.id, doctor.total_reviews]);

    const isTestingService = doctor.provider_type === "testing_service";
    const primarySpecialty = doctor.specialties?.find((s) => s.is_primary)
      ?.specialty || doctor.specialties?.[0]?.specialty;

    const selectedDay = cardAvailability?.days[selectedDayIndex];

    const handleConsultationTypeChange = async (newType: string) => {
      if (newType === activeConsultationType) return;
      setActiveConsultationType(newType);
      setSelectedDayIndex(0);
      setLoadingAvailability(true);
      try {
        const result = await getMultiDayAvailabilityBatch([doctor.id], newType);
        setCardAvailability(result[doctor.id] || null);
      } catch {
        setCardAvailability(null);
      }
      setLoadingAvailability(false);
    };

    const showTypeToggle =
      doctor.consultation_types &&
      doctor.consultation_types.length > 1 &&
      availability !== undefined;

    const hasAvailability = availability !== undefined;

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
              {/* Desktop: horizontal split layout (info left | availability right) */}
              <div className={cn(
                "flex flex-col",
                hasAvailability && "lg:flex-row lg:gap-5"
              )}>
                {/* ── LEFT SIDE: Doctor info ── */}
                <div className={cn(
                  "min-w-0",
                  hasAvailability ? "lg:flex-1" : "w-full"
                )}>
                  <div className="flex gap-4">
                    {/* Avatar */}
                    <Avatar className={cn("h-16 w-16 shrink-0", isTestingService && "rounded-xl")}>
                      {doctor.profile.avatar_url ? (
                        <AvatarImage
                          src={doctor.profile.avatar_url}
                          alt={`${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`}
                        />
                      ) : null}
                      <AvatarFallback className={cn("text-lg", isTestingService && "rounded-xl bg-teal-50 dark:bg-teal-950/30")}>
                        {isTestingService ? (
                          <FlaskConical className="h-6 w-6 text-teal-600" />
                        ) : (
                          <User className="h-6 w-6" />
                        )}
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
                          {doctor.avg_rating > 0 && (
                            <div className="mt-1">
                              <StarRating
                                rating={doctor.avg_rating}
                                totalReviews={doctor.total_reviews}
                                size="sm"
                                showCount
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          {isTestingService && (
                            <Badge className="shrink-0 bg-teal-100 text-teal-800 hover:bg-teal-100 text-xs dark:bg-teal-900/40 dark:text-teal-300">
                              <FlaskConical className="mr-1 h-3 w-3" />
                              Testing
                            </Badge>
                          )}
                          {doctor.is_featured && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              Featured
                            </Badge>
                          )}
                          {matchScore != null && matchScore > 0 && (
                            <Badge className="shrink-0 bg-primary/10 text-primary hover:bg-primary/10 text-xs">
                              {matchScore}% Match
                            </Badge>
                          )}
                        </div>
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

                      {/* Badges */}
                      <div className="mt-2 flex items-center gap-3">
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
                        {doctor.is_wheelchair_accessible &&
                          doctor.consultation_types?.includes("in_person") && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Accessibility className="h-3.5 w-3.5" />
                            <span className="text-xs">Accessible</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Price + Book — always visible on left side */}
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
                        / {isTestingService ? "test" : "session"}
                      </span>
                      <span className="block text-[10px] text-muted-foreground/70">
                        + booking fee
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="group-hover:bg-primary group-hover:text-primary-foreground"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        router.push(`/doctors/${doctor.slug}/book`);
                      }}
                    >
                      Book Now
                    </Button>
                  </div>
                </div>

                {/* ── RIGHT SIDE: Availability (desktop: side-by-side, mobile: below) ── */}
                {hasAvailability && (
                  <div className={cn(
                    "border-t pt-3 mt-3",
                    "lg:border-t-0 lg:border-l lg:pt-0 lg:mt-0 lg:pl-5",
                    "lg:w-[45%] lg:shrink-0"
                  )}>
                    {/* Consultation Type Toggle */}
                    {showTypeToggle && (
                      <div className="mb-3">
                        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
                          {doctor.consultation_types!.includes("in_person") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleConsultationTypeChange("in_person");
                              }}
                              className={cn(
                                "flex-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                                activeConsultationType === "in_person"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              In Person
                            </button>
                          )}
                          {doctor.consultation_types!.includes("video") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleConsultationTypeChange("video");
                              }}
                              className={cn(
                                "flex-1 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                                activeConsultationType === "video"
                                  ? "bg-background text-foreground shadow-sm"
                                  : "text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Video
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Multi-Day Availability */}
                    {loadingAvailability ? (
                      <div className="flex h-20 items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : cardAvailability && cardAvailability.days.length > 0 ? (
                      <div>
                        {/* Day selector tabs with arrow navigation */}
                        <div className="mb-2 flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (selectedDayIndex > 0) setSelectedDayIndex(selectedDayIndex - 1);
                              dayScrollRef.current?.scrollBy({ left: -60, behavior: "smooth" });
                            }}
                            className={cn(
                              "shrink-0 rounded-md p-0.5 transition-colors",
                              selectedDayIndex > 0
                                ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                : "text-muted-foreground/30 cursor-default"
                            )}
                            disabled={selectedDayIndex === 0}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <div
                            ref={dayScrollRef}
                            className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            {cardAvailability.days.map((day, idx) => (
                              <button
                                key={day.date}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setSelectedDayIndex(idx);
                                }}
                                className={cn(
                                  "shrink-0 rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
                                  idx === selectedDayIndex
                                    ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                    : "text-muted-foreground hover:bg-muted"
                                )}
                              >
                                {formatShortDateLabel(day.date)}
                              </button>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (cardAvailability && selectedDayIndex < cardAvailability.days.length - 1) {
                                setSelectedDayIndex(selectedDayIndex + 1);
                              }
                              dayScrollRef.current?.scrollBy({ left: 60, behavior: "smooth" });
                            }}
                            className={cn(
                              "shrink-0 rounded-md p-0.5 transition-colors",
                              cardAvailability && selectedDayIndex < cardAvailability.days.length - 1
                                ? "text-muted-foreground hover:bg-muted hover:text-foreground"
                                : "text-muted-foreground/30 cursor-default"
                            )}
                            disabled={!cardAvailability || selectedDayIndex >= cardAvailability.days.length - 1}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Slots for selected day */}
                        {selectedDay && (
                          <div className="grid grid-cols-4 lg:grid-cols-3 gap-1.5">
                            {selectedDay.slots.slice(0, 9).map((slot) => (
                              <button
                                key={slot.start}
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  router.push(
                                    `/doctors/${doctor.slug}/book?date=${selectedDay.date}&type=${activeConsultationType}&time=${encodeURIComponent(slot.start)}`
                                  );
                                }}
                                className="inline-flex items-center justify-center rounded-md border border-primary/20 bg-primary/5 px-1 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
                              >
                                {formatSlotTime(slot.start)}
                              </button>
                            ))}
                            {selectedDay.slots.length > 9 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setShowFullAvailability(true);
                                }}
                                className="inline-flex items-center justify-center rounded-md border border-dashed border-muted-foreground/30 px-1 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
                              >
                                +{selectedDay.slots.length - 9} more
                              </button>
                            )}
                          </div>
                        )}

                        {/* View full calendar link */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setShowFullAvailability(true);
                          }}
                          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                        >
                          <CalendarDays className="h-3 w-3" />
                          View full calendar
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        No availability in next 14 days
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Full Availability Calendar Modal */}
        {showFullAvailability && (
          <Dialog open={showFullAvailability} onOpenChange={setShowFullAvailability}>
            <DialogContent className="max-w-sm md:max-w-5xl p-4 md:p-6 gap-2 max-h-[90vh] flex flex-col">
              {/* Mobile header (hidden on desktop where left panel shows name) */}
              <DialogHeader className="pb-0 shrink-0 md:hidden">
                <DialogTitle className="text-base">
                  {doctor.title} {doctor.profile.first_name} {doctor.profile.last_name}
                </DialogTitle>
              </DialogHeader>
              {/* Desktop sr-only title for a11y */}
              <DialogTitle className="sr-only md:sr-only">
                {doctor.title} {doctor.profile.first_name} {doctor.profile.last_name}
              </DialogTitle>
              <DialogDescription className="sr-only">
                View availability and book an appointment
              </DialogDescription>

              <div className="overflow-y-auto min-h-0 -mx-1 px-1">
                <div className="flex flex-col md:grid md:grid-cols-[2fr_3fr] md:gap-6">
                  {/* ── Left Panel: Doctor Profile (desktop only) ── */}
                  <div className="hidden md:flex md:flex-col md:justify-between md:border-r md:pr-6 md:overflow-hidden">
                    {/* Top: Avatar + Name + Details */}
                    <div>
                      <div className="flex flex-col items-center text-center">
                        <Avatar className={cn("h-16 w-16", isTestingService && "rounded-xl")}>
                          {doctor.profile.avatar_url ? (
                            <AvatarImage
                              src={doctor.profile.avatar_url}
                              alt={`${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`}
                            />
                          ) : null}
                          <AvatarFallback className={cn("text-xl", isTestingService && "rounded-xl bg-teal-50 dark:bg-teal-950/30")}>
                            {isTestingService ? (
                              <FlaskConical className="h-6 w-6 text-teal-600" />
                            ) : (
                              <User className="h-6 w-6" />
                            )}
                          </AvatarFallback>
                        </Avatar>

                        <h3 className="mt-2 text-base font-semibold leading-tight">
                          {doctor.title} {doctor.profile.first_name} {doctor.profile.last_name}
                        </h3>

                        {primarySpecialty && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {primarySpecialty.name_key
                              .replace("specialty.", "")
                              .replace(/_/g, " ")
                              .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                          </p>
                        )}

                        {doctor.avg_rating > 0 && (
                          <div className="mt-1.5">
                            <StarRating
                              rating={doctor.avg_rating}
                              totalReviews={doctor.total_reviews}
                              size="sm"
                              showCount
                            />
                          </div>
                        )}
                      </div>

                      {/* Detail rows — centered */}
                      <div className="mt-3 flex flex-col items-center gap-2 text-xs">
                        {doctor.location && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            <span>{doctor.location.city}, {doctor.location.country_code}</span>
                          </div>
                        )}

                        {doctor.verification_status === "verified" && (
                          <div className="flex items-center gap-1.5 text-green-600">
                            <Shield className="h-3.5 w-3.5 shrink-0" />
                            <span>Verified</span>
                          </div>
                        )}

                        <div className="flex items-center gap-2.5">
                          {doctor.consultation_types?.includes("video") && (
                            <div className="flex items-center gap-1 text-purple-600">
                              <Video className="h-3.5 w-3.5" />
                              <span>Video</span>
                            </div>
                          )}
                          {doctor.consultation_types?.includes("in_person") && (
                            <div className="flex items-center gap-1 text-blue-600">
                              <User className="h-3.5 w-3.5" />
                              <span>In Person</span>
                            </div>
                          )}
                        </div>

                        {doctor.languages && doctor.languages.length > 0 && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Globe className="h-3.5 w-3.5 shrink-0" />
                            <span>{doctor.languages.map((l) => l.toUpperCase()).join(", ")}</span>
                          </div>
                        )}
                      </div>

                      {/* Featured review quote */}
                      {featuredReview && (
                        <div className="mt-3 rounded-lg bg-primary/5 border border-primary/10 p-2.5">
                          <Quote className="h-3 w-3 text-primary/40 mb-1" />
                          <p className="text-[11px] leading-relaxed text-muted-foreground italic line-clamp-3">
                            {featuredReview.comment}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground/70 font-medium">
                            — {featuredReview.firstName} {featuredReview.lastInitial}.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Bottom: Fee + link */}
                    <div>
                      {/* Fee card */}
                      <div className="mt-3 rounded-lg bg-muted/50 p-2.5 text-center">
                        <span className="text-lg font-bold">
                          {formatCurrency(doctor.consultation_fee_cents, doctor.base_currency, locale)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {" "}/ {isTestingService ? "test" : "session"}
                        </span>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5">+ booking fee</p>
                      </div>

                      {/* View profile link */}
                      <Link
                        href={`/doctors/${doctor.slug}`}
                        className="mt-2 inline-flex items-center justify-center w-full text-xs font-medium text-primary hover:underline"
                      >
                        View Full Profile →
                      </Link>
                    </div>
                  </div>

                  {/* ── Right Panel: Calendar + Times (always visible) ── */}
                  <div className="min-w-0">
                    <AvailabilityCalendar
                      doctorId={doctor.id}
                      doctorSlug={doctor.slug}
                      consultationType={activeConsultationType}
                      consultationTypes={doctor.consultation_types}
                      initialDate={cardAvailability?.days[0]?.date}
                      locale={locale}
                      compact
                    />
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
  }
);
