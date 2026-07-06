import { Skeleton } from "@/components/ui/skeleton";

export default function DoctorProfileLoading() {
  return (
    <div className="relative min-h-screen">
      {/* ── Hero band ── */}
      <div className="relative bg-gradient-to-br from-primary via-primary/90 to-teal-600 dark:from-primary/80 dark:via-primary/70 dark:to-teal-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_-20%,rgba(255,255,255,0.12),transparent_60%)]" />
        <div className="relative container mx-auto px-4 pb-20 pt-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-32 bg-white/15" />
            <Skeleton className="h-8 w-8 rounded-full bg-white/15" />
          </div>
          <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-center">
            <Skeleton className="h-20 w-20 shrink-0 rounded-full bg-white/20 sm:h-24 sm:w-24" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-8 w-64 bg-white/20" />
              <Skeleton className="mt-2 h-5 w-40 bg-white/15" />
              <div className="mt-3 flex flex-wrap gap-4">
                <Skeleton className="h-4 w-28 bg-white/15" />
                <Skeleton className="h-4 w-32 bg-white/15" />
                <Skeleton className="h-4 w-24 bg-white/15" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content — pulled up over the hero ── */}
      <div className="relative container mx-auto px-4 -mt-12 pb-8">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <Skeleton className="h-96 w-full rounded-xl" />
              <Skeleton className="h-40 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
