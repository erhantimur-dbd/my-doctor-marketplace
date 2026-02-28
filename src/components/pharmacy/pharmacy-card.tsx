"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Phone, Clock, ExternalLink } from "lucide-react";
import type { Pharmacy } from "@/types/pharmacy";

interface PharmacyCardProps {
  pharmacy: Pharmacy;
  compact?: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getTodayHours(pharmacy: Pharmacy): string | null {
  if (!pharmacy.openingTimes || pharmacy.openingTimes.length === 0) return null;
  const today = DAYS[new Date().getDay()];
  const entry = pharmacy.openingTimes.find((t) => t.Weekday === today);
  if (!entry) return null;
  if (!entry.IsOpen) return "Closed today";
  return `${entry.OpeningTime} – ${entry.ClosingTime}`;
}

export function PharmacyCard({
  pharmacy,
  compact,
  isHovered,
  onHover,
}: PharmacyCardProps) {
  const todayHours = getTodayHours(pharmacy);

  return (
    <Card
      className={`transition-all ${isHovered ? "ring-2 ring-primary shadow-md" : ""}`}
      onMouseEnter={() => onHover(pharmacy.id)}
      onMouseLeave={() => onHover(null)}
    >
      <CardContent className={compact ? "p-4" : "p-5"}>
        <div className="flex items-start justify-between gap-2">
          <h3
            className={`font-semibold leading-tight ${compact ? "text-sm" : ""}`}
          >
            {pharmacy.name}
          </h3>
          {pharmacy.subType && !compact && (
            <Badge variant="secondary" className="shrink-0 text-xs">
              {pharmacy.subType}
            </Badge>
          )}
        </div>

        <div className="mt-2 space-y-1.5 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              {pharmacy.address}, {pharmacy.postcode}
            </span>
          </div>

          {pharmacy.phone && (
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <a
                href={`tel:${pharmacy.phone}`}
                className="hover:text-foreground hover:underline"
              >
                {pharmacy.phone}
              </a>
            </div>
          )}

          {todayHours && (
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span
                className={
                  todayHours === "Closed today" ? "text-red-500" : ""
                }
              >
                {todayHours}
              </span>
            </div>
          )}
        </div>

        {!compact && pharmacy.website && (
          <a
            href={
              pharmacy.website.startsWith("http")
                ? pharmacy.website
                : `https://${pharmacy.website}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Visit website <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
