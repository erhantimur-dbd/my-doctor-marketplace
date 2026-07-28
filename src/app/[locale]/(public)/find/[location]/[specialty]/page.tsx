import { notFound } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { searchDoctors, getSpecialties } from "@/actions/search";
import { getCityBySlug, UK_SEO_CITIES } from "@/lib/constants/uk-cities";
import { SPECIALTIES, getSpecialtyMeta } from "@/lib/constants/specialties";
import { formatSpecialtyName } from "@/lib/utils";
import { generateMetadata as seoMetadata } from "@/lib/seo/metadata";
import { faqJsonLd } from "@/lib/seo/json-ld";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; location: string; specialty: string }>;
}

export async function generateStaticParams() {
  // Limit build-time paths: top cities × all specialties
  const cities = UK_SEO_CITIES.slice(0, 12);
  const specs = SPECIALTIES.filter((s) => s.category !== "testing").slice(0, 20);
  return cities.flatMap((city) =>
    specs.map((spec) => ({
      location: city.slug,
      specialty: spec.slug,
    }))
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, location, specialty } = await params;
  const city = getCityBySlug(location);
  const meta = getSpecialtyMeta(specialty);
  if (!city || !meta) return { title: "Not Found" };

  const name = formatSpecialtyName(meta.nameKey);
  return seoMetadata({
    title: `Best ${name} in ${city.name} — Book Private Care`,
    description: `Find and book verified ${name.toLowerCase()} specialists in ${city.name}. Compare ratings, fees, insurance, and live availability on MyDoctors360.`,
    path: `/${locale}/find/${location}/${specialty}`,
  });
}

export default async function CitySpecialtyPage({ params }: PageProps) {
  const { locale, location, specialty } = await params;
  const city = getCityBySlug(location);
  const meta = getSpecialtyMeta(specialty);
  if (!city || !meta) notFound();

  const name = formatSpecialtyName(meta.nameKey);

  const result = await searchDoctors({
    specialty,
    location: city.slug,
    sort: "featured",
    page: 1,
  });

  // If exact city slug yields few results, broaden to country
  let doctors = (result.doctors || []) as unknown as Parameters<
    typeof DoctorCard
  >[0]["doctor"][];
  let total = result.total;

  if (doctors.length < 3) {
    const broadened = await searchDoctors({
      specialty,
      location: `country-${city.countryCode.toLowerCase()}`,
      sort: "featured",
      page: 1,
    });
    if ((broadened.doctors?.length || 0) > doctors.length) {
      doctors = broadened.doctors as unknown as typeof doctors;
      total = broadened.total;
    }
  }

  const faqs = [
    {
      question: `How much does a private ${name.toLowerCase()} cost in ${city.name}?`,
      answer: `Fees vary by specialist and consultation type. On MyDoctors360 you can compare consultation fees and book online. Many ${name.toLowerCase()} specialists also accept private medical insurance.`,
    },
    {
      question: `Can I book a ${name.toLowerCase()} appointment online in ${city.name}?`,
      answer: `Yes. Choose a verified specialist, pick a live slot, and pay securely on MyDoctors360 — including video consultations where offered.`,
    },
    {
      question: `Are ${name.toLowerCase()} specialists in ${city.name} verified?`,
      answer: `Doctors on MyDoctors360 complete verification including professional registration checks before appearing in search results.`,
    },
  ];

  const faqSchema = faqJsonLd(faqs);
  const allSpecs = await getSpecialties();

  return (
    <div className="container mx-auto max-w-5xl px-4 py-10">
      {faqSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <nav className="mb-4 text-sm text-muted-foreground">
        <Link href="/doctors" className="hover:text-foreground">
          Find a doctor
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">
          {name} in {city.name}
        </span>
      </nav>

      <h1 className="text-3xl font-bold tracking-tight">
        {name} in {city.name}
      </h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Book verified private {name.toLowerCase()} specialists in {city.name}. Compare ratings,
        fees, insurers accepted, and live availability — then pay online.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={`/doctors?specialty=${specialty}&location=${city.slug}`}>
            Open full search ({total})
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href={`/specialties/${specialty}`}>About {name}</Link>
        </Button>
      </div>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">
          Top {name.toLowerCase()} specialists near {city.name}
        </h2>
        {doctors.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              No specialists found yet. Try a nearby city or video consultation.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {doctors.slice(0, 12).map((doctor) => (
              <DoctorCard key={doctor.id} doctor={doctor} locale={locale} compact />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Popular questions</h2>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.question} className="rounded-lg border p-4">
              <p className="font-medium">{faq.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Other specialties in {city.name}</h2>
        <div className="flex flex-wrap gap-2">
          {(allSpecs || [])
            .filter((s: { slug: string }) => s.slug !== specialty)
            .slice(0, 16)
            .map((s: { slug: string; name_key: string }) => (
              <Link
                key={s.slug}
                href={`/find/${city.slug}/${s.slug}`}
                className="rounded-full border px-3 py-1 text-sm hover:bg-accent"
              >
                {formatSpecialtyName(s.name_key)}
              </Link>
            ))}
        </div>
      </section>
    </div>
  );
}
