import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Heart,
  Star,
  MapPin,
  Shield,
  Video,
  User,
  Search,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils/currency";
import { RemoveFavoriteButton } from "./remove-favorite-button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saved Doctors",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FavoriteRow = any;

interface FavoritesPageProps {
  params: Promise<{ locale: string }>;
}

export default async function FavoritesPage({ params }: FavoritesPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/en/login");

  const { data: favorites, error } = await supabase
    .from("favorites")
    .select(
      `
      id,
      created_at,
      doctor:doctors(
        id, slug, title,
        consultation_fee_cents, base_currency,
        avg_rating, total_reviews,
        verification_status, consultation_types,
        is_featured,
        profile:profiles(first_name, last_name, avatar_url),
        location:locations(city, country_code),
        specialties:doctor_specialties(
          specialty:specialties(name_key, slug),
          is_primary
        )
      )
    `
    )
    .eq("patient_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Saved Doctors</h1>
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-muted-foreground">
              Unable to load saved doctors. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const typedFavorites = (favorites || []) as unknown as FavoriteRow[];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Saved Doctors</h1>

      {typedFavorites.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Heart className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-medium">No saved doctors yet</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Browse our doctors and save the ones you&apos;re interested in to
              quickly find them later.
            </p>
            <Button className="mt-6" asChild>
              <Link href="/doctors">
                <Search className="mr-2 h-4 w-4" />
                Browse Doctors
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {typedFavorites.map((favorite) => {
            const doctor = favorite.doctor;
            const doctorName = `${doctor.title || ""} ${doctor.profile.first_name} ${doctor.profile.last_name}`.trim();
            const primarySpecialty =
              doctor.specialties?.find((s: any) => s.is_primary)?.specialty ||
              doctor.specialties?.[0]?.specialty;

            return (
              <Card
                key={favorite.id}
                className="group relative h-full transition-all hover:border-primary/50 hover:shadow-lg"
              >
                <CardContent className="p-5">
                  {/* Remove button */}
                  <div className="absolute right-3 top-3 z-10">
                    <RemoveFavoriteButton favoriteId={favorite.id} />
                  </div>

                  <div className="flex gap-4">
                    {/* Avatar */}
                    <Avatar className="h-14 w-14 shrink-0">
                      {doctor.profile.avatar_url ? (
                        <AvatarImage
                          src={doctor.profile.avatar_url}
                          alt={doctorName}
                        />
                      ) : null}
                      <AvatarFallback className="text-lg">
                        <User className="h-6 w-6" />
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold">{doctorName}</h3>
                      {primarySpecialty && (
                        <p className="text-sm text-muted-foreground">
                          {primarySpecialty.name_key
                            .replace("specialty.", "")
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5">
                    {doctor.location && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {doctor.location.city}, {doctor.location.country_code}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-sm">
                      {doctor.avg_rating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium">
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
                    <Button size="sm" asChild>
                      <Link href={`/doctors/${doctor.slug}`}>
                        View Profile
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
