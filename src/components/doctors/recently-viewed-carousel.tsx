"use client";

import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";

export function RecentlyViewedCarousel() {
  const { doctors } = useRecentlyViewed();

  if (doctors.length === 0) return null;

  return (
    <section className="py-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
          Recently Viewed
        </h3>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {doctors.map((doc) => (
          <Link
            key={doc.id}
            href={`/doctors/${doc.slug}`}
            className="shrink-0"
          >
            <Card className="w-48 transition-shadow hover:shadow-md">
              <CardContent className="p-4 text-center">
                <Avatar className="mx-auto mb-2 h-12 w-12">
                  {doc.avatarUrl && <AvatarImage src={doc.avatarUrl} />}
                  <AvatarFallback className="text-sm">
                    {doc.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-sm truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.specialty}
                </p>
                {doc.rating > 0 && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-xs">{doc.rating.toFixed(1)}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
