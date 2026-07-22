import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  CONDITION_HUBS,
  conditionHubSearchHref,
  getConditionHub,
} from "@/lib/constants/condition-hubs";
import { formatSpecialtyName } from "@/lib/utils";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateStaticParams() {
  return CONDITION_HUBS.map((h) => ({ slug: h.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const hub = getConditionHub(slug);
  if (!hub) return { title: "Condition not found" };
  return {
    title: `${hub.title} — Find & book specialists`,
    description: hub.description,
  };
}

export default async function ConditionHubPage({ params }: PageProps) {
  const { slug } = await params;
  const hub = getConditionHub(slug);
  if (!hub) notFound();

  const specialtyLabel = formatSpecialtyName(
    hub.specialtySlug.replace(/-/g, "_")
  );
  const searchHref = conditionHubSearchHref(hub);

  return (
    <div className="container mx-auto px-4 py-10">
      <nav className="mb-6 text-sm text-muted-foreground">
        <Link href="/conditions" className="hover:text-foreground">
          Conditions
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{hub.title}</span>
      </nav>

      <div className="mx-auto max-w-2xl">
        <div className="text-4xl" aria-hidden>
          {hub.emoji}
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
          {hub.title}
        </h1>
        <p className="mt-3 text-lg text-muted-foreground">{hub.description}</p>

        <div className="mt-6 rounded-xl border bg-muted/30 p-4 text-sm">
          <p>
            <span className="font-medium">Suggested specialty:</span>{" "}
            {specialtyLabel}
          </p>
          <p className="mt-1 text-muted-foreground">
            Results are sorted by soonest available appointment so you can book
            faster.
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button size="lg" asChild className="rounded-full">
            <Link href={searchHref}>Find doctors for {hub.title}</Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="rounded-full">
            <Link href={`/specialties/${hub.specialtySlug}`}>
              Browse {specialtyLabel}
            </Link>
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          This is guidance only and not a medical diagnosis. If you have severe
          or emergency symptoms, seek urgent care immediately.
        </p>
      </div>
    </div>
  );
}
