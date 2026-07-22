import { Link } from "@/i18n/navigation";
import { CONDITION_HUBS, conditionHubSearchHref } from "@/lib/constants/condition-hubs";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Health conditions — Find the right doctor",
  description:
    "Browse common conditions and book verified private specialists on MyDoctors360.",
};

export default function ConditionsIndexPage() {
  return (
    <div className="container mx-auto px-4 py-10">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-3xl font-bold tracking-tight">Browse by condition</h1>
        <p className="mt-2 text-muted-foreground">
          Not sure which specialty you need? Start with a common concern and we&apos;ll
          show verified doctors who can help.
        </p>
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CONDITION_HUBS.map((hub) => (
          <Link
            key={hub.slug}
            href={`/conditions/${hub.slug}`}
            className="group rounded-2xl border bg-card p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md"
          >
            <div className="text-2xl" aria-hidden>
              {hub.emoji}
            </div>
            <h2 className="mt-3 text-lg font-semibold group-hover:text-primary">
              {hub.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground line-clamp-3">
              {hub.description}
            </p>
            <p className="mt-3 text-sm font-medium text-primary">
              Find doctors →
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-10 text-center">
        <Link href="/doctors" className="text-sm text-primary hover:underline">
          Or browse all doctors
        </Link>
      </div>
    </div>
  );
}
