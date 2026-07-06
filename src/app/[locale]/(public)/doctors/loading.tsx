import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorsLoading() {
  return (
    <div>
      {/* ── Search hero area with brand gradient ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative container mx-auto px-4 pb-5 pt-6 lg:pb-7 lg:pt-8">
          <Skeleton className="h-8 w-56 bg-white/20" />
          <Skeleton className="mt-2 h-4 w-40 bg-white/15" />
        </div>
      </div>

      {/* ── Results area ── */}
      <div className="container mx-auto px-4 py-4 lg:py-6">
        <div className="flex flex-col gap-4">
          {/* Filter bar placeholder */}
          <Skeleton className="h-12 w-full rounded-xl" />

          {/* Result card skeletons */}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border bg-background p-5 shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <Skeleton className="h-14 w-14 shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Skeleton className="h-9 w-28 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
