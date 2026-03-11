import Link from "next/link";
import { Lightbulb, ArrowRight, Video, MapPin, Stethoscope, Layers } from "lucide-react";
import type { SearchExpansion } from "@/actions/search";

interface SearchExpansionBannerProps {
  suggestions: SearchExpansion[];
  resultCount: number;
}

const typeIcons: Record<string, React.ElementType> = {
  try_video: Video,
  remove_location: MapPin,
  remove_consultation_type: Layers,
  broaden_specialty: Stethoscope,
};

export function SearchExpansionBanner({
  suggestions,
  resultCount,
}: SearchExpansionBannerProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3 dark:border-blue-900/40 dark:bg-blue-950/20">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-800 dark:text-blue-300">
        <Lightbulb className="h-4 w-4 shrink-0" />
        <span>
          {resultCount === 0
            ? "No results found. Try expanding your search:"
            : `Only ${resultCount} result${resultCount > 1 ? "s" : ""} found. Try expanding your search:`}
        </span>
      </div>

      <ul className="mt-2 space-y-1.5 pl-6">
        {suggestions.map((s) => {
          const Icon = typeIcons[s.type] || ArrowRight;
          return (
            <li key={s.type}>
              <Link
                href={s.url}
                className="group inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-200"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="underline decoration-blue-300 underline-offset-2 group-hover:decoration-blue-500 dark:decoration-blue-700 dark:group-hover:decoration-blue-400">
                  {s.label}
                </span>
                <span className="text-xs text-blue-500 dark:text-blue-500">
                  — {s.count} doctor{s.count > 1 ? "s" : ""} available
                </span>
                <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
