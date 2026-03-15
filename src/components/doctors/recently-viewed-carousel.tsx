"use client";

import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star, Clock } from "lucide-react";
import { Link } from "@/i18n/navigation";

export function RecentlyViewedCarousel() {
  const { doctors } = useRecentlyViewed();

  if (doctors.length === 0) return null;

  return (
    <section className="py-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Clock className="h-3.5 w-3.5 text-white/60" />
        <h3 className="font-medium text-xs text-white/60 uppercase tracking-wider">
          Recently Viewed
        </h3>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {doctors.map((doc) => (
          <Link
            key={doc.id}
            href={`/doctors/${doc.slug}`}
            className="shrink-0"
          >
            <div className="flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-sm pl-1 pr-3 py-1 transition-colors hover:bg-white/25">
              <Avatar className="h-7 w-7">
                {doc.avatarUrl && <AvatarImage src={doc.avatarUrl} />}
                <AvatarFallback className="text-[9px] bg-white/20 text-white">
                  {doc.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium text-xs text-white truncate max-w-[6rem]">{doc.name}</p>
                <div className="flex items-center gap-1">
                  <p className="text-[10px] text-white/70 truncate">
                    {doc.specialty}
                  </p>
                  {doc.rating > 0 && (
                    <>
                      <span className="text-white/40">·</span>
                      <Star className="h-2.5 w-2.5 fill-yellow-300 text-yellow-300" />
                      <span className="text-[10px] text-white/80">{doc.rating.toFixed(1)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
