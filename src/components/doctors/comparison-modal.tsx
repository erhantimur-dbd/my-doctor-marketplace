"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Star, MapPin, Video, User as UserIcon } from "lucide-react";
import { useDoctorCompare, type CompareDoctor } from "@/hooks/use-doctor-compare";
import { formatCurrency } from "@/lib/utils/currency";
import { Link } from "@/i18n/navigation";

function CompareColumn({ doctor }: { doctor: CompareDoctor }) {
  return (
    <div className="flex-1 space-y-4 text-center">
      {/* Avatar + Name */}
      <div className="flex flex-col items-center gap-2">
        <Avatar className="h-16 w-16">
          {doctor.avatarUrl && (
            <AvatarImage src={doctor.avatarUrl} alt={doctor.name} />
          )}
          <AvatarFallback>
            <UserIcon className="h-6 w-6" />
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold text-sm">{doctor.name}</p>
          <p className="text-xs text-muted-foreground">{doctor.specialty}</p>
        </div>
      </div>

      <Separator />

      {/* Rating */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Rating</p>
        <div className="flex items-center justify-center gap-1">
          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
          <span className="font-medium text-sm">
            {doctor.rating > 0 ? doctor.rating.toFixed(1) : "New"}
          </span>
          {doctor.reviewCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({doctor.reviewCount})
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* Location */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Location</p>
        <div className="flex items-center justify-center gap-1 text-sm">
          <MapPin className="h-3.5 w-3.5" />
          <span>{doctor.city || "Not specified"}</span>
        </div>
      </div>

      <Separator />

      {/* Consultation Types */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Consultations</p>
        <div className="flex flex-wrap justify-center gap-1">
          {doctor.consultationTypes?.includes("in_person") && (
            <Badge variant="secondary" className="text-xs">In-Person</Badge>
          )}
          {doctor.consultationTypes?.includes("video") && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Video className="h-3 w-3" />
              Video
            </Badge>
          )}
        </div>
      </div>

      <Separator />

      {/* Price */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Consultation Fee</p>
        <p className="font-semibold text-sm">
          {formatCurrency(doctor.consultationFeeCents, doctor.currency)}
        </p>
        {doctor.videoFeeCents != null && doctor.videoFeeCents !== doctor.consultationFeeCents && (
          <p className="text-xs text-muted-foreground">
            Video: {formatCurrency(doctor.videoFeeCents, doctor.currency)}
          </p>
        )}
      </div>

      <Separator />

      {/* Experience */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Experience</p>
        <p className="font-medium text-sm">
          {doctor.yearsExperience
            ? `${doctor.yearsExperience} years`
            : "Not specified"}
        </p>
      </div>

      {/* Book Button */}
      <Button size="sm" className="w-full" asChild>
        <Link href={`/doctors/${doctor.slug}`}>
          Book Now
        </Link>
      </Button>
    </div>
  );
}

export function ComparisonModal() {
  const { compareList, isCompareOpen, setCompareOpen } = useDoctorCompare();

  return (
    <Dialog open={isCompareOpen} onOpenChange={setCompareOpen}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Compare Doctors</DialogTitle>
        </DialogHeader>
        <div className="flex gap-4 overflow-x-auto py-4">
          {compareList.map((doctor) => (
            <CompareColumn key={doctor.id} doctor={doctor} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
