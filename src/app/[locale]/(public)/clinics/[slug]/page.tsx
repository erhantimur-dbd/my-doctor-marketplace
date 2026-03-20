import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicClinicLocations } from "@/actions/clinic-locations";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Star,
  Clock,
  ChevronRight,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

// ─── Metadata (SEO) ──────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, locale } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name, description, seo_title, seo_description, logo_url, slug")
    .eq("slug", slug)
    .single();

  if (!org) return { title: "Clinic Not Found" };

  const title = org.seo_title ?? `${org.name} — Private Healthcare Clinic | MyDoctors360`;
  const description =
    org.seo_description ??
    org.description ??
    `Book private appointments with doctors at ${org.name}. Fast access to specialists near you.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: org.logo_url ? [{ url: org.logo_url }] : [],
      type: "website",
    },
    alternates: {
      canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${locale}/clinics/${slug}`,
    },
  };
}

// ─── Page ────────────────────────────────────────────────────

export default async function ClinicPublicPage({ params }: Props) {
  const { locale, slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizations")
    .select(`
      id, name, slug, logo_url, cover_image_url,
      description, website, phone, email,
      city, country, specialties
    `)
    .eq("slug", slug)
    .single();

  if (!org) notFound();

  // Validate org has an active license on a clinic tier
  const { data: license } = await supabase
    .from("licenses")
    .select("tier, status")
    .eq("organization_id", org.id)
    .in("tier", ["clinic", "enterprise"])
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();

  if (!license) notFound();

  // Fetch locations + doctors
  const { locations } = await getPublicClinicLocations(org.id);

  // Flatten all doctors across all locations (deduplicated)
  const allDoctorMap = new Map<string, any>();
  for (const loc of locations) {
    const assignments: any[] = loc.doctor_location_assignments ?? [];
    for (const a of assignments) {
      const doc = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
      if (doc?.id && !allDoctorMap.has(doc.id)) {
        allDoctorMap.set(doc.id, doc);
      }
    }
  }
  const allDoctors = Array.from(allDoctorMap.values());

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: org.name,
    description: org.description,
    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/${locale}/clinics/${slug}`,
    logo: org.logo_url,
    telephone: org.phone,
    email: org.email,
    address: org.city
      ? { "@type": "PostalAddress", addressLocality: org.city, addressCountry: org.country ?? "GB" }
      : undefined,
    hasMap: org.website,
    medicalSpecialty: org.specialties,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <div className="relative bg-gradient-to-br from-sky-700 to-sky-900 text-white">
        {org.cover_image_url && (
          <img
            src={org.cover_image_url}
            alt={org.name}
            className="absolute inset-0 h-full w-full object-cover opacity-20"
          />
        )}
        <div className="relative mx-auto max-w-5xl px-6 py-16">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {org.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-20 w-20 rounded-2xl border-2 border-white/30 object-cover shadow-xl"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white/20 shadow-xl">
                <Building2 className="h-10 w-10 text-white" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">{org.name}</h1>
              {org.city && (
                <p className="mt-1 flex items-center gap-1.5 text-sky-200">
                  <MapPin className="h-4 w-4" />{org.city}
                </p>
              )}
              {org.specialties && org.specialties.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {org.specialties.slice(0, 5).map((s: string) => (
                    <Badge key={s} className="bg-white/20 text-white border-white/30 hover:bg-white/30">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 py-10 space-y-10">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {org.description && (
              <section>
                <h2 className="mb-3 text-xl font-semibold">About {org.name}</h2>
                <p className="text-muted-foreground leading-relaxed">{org.description}</p>
              </section>
            )}

            {/* Doctors */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">
                Our Doctors
                {allDoctors.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">({allDoctors.length})</span>
                )}
              </h2>
              {allDoctors.length === 0 ? (
                <p className="text-muted-foreground text-sm">Coming soon — check back shortly.</p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {allDoctors.map((doc) => {
                    const profile = Array.isArray(doc.profile) ? doc.profile[0] : doc.profile;
                    const specialties: any[] = doc.specialties ?? [];
                    const primarySpecialty = specialties[0]?.specialty;
                    const specName = Array.isArray(primarySpecialty)
                      ? primarySpecialty[0]?.name_key
                      : primarySpecialty?.name_key;

                    return (
                      <Link
                        key={doc.id}
                        href={`/${locale}/doctors/${doc.slug}`}
                        className="group"
                      >
                        <Card className="transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-4 p-4">
                            {profile?.avatar_url ? (
                              <img
                                src={profile.avatar_url}
                                alt={`Dr. ${profile.last_name}`}
                                className="h-14 w-14 rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
                                <Stethoscope className="h-6 w-6 text-blue-600" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">
                                Dr. {profile?.first_name} {profile?.last_name}
                              </p>
                              {specName && (
                                <p className="text-sm text-muted-foreground truncate">{specName}</p>
                              )}
                              {doc.consultation_fee_cents && (
                                <p className="text-sm font-medium text-sky-700 mt-0.5">
                                  From £{(doc.consultation_fee_cents / 100).toFixed(0)}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-sky-600 transition-colors shrink-0" />
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Locations */}
            <section>
              <h2 className="mb-4 text-xl font-semibold">Our Locations</h2>
              <div className="space-y-4">
                {locations.map((loc) => (
                  <Card key={loc.id}>
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 shrink-0">
                          <MapPin className="h-4 w-4 text-sky-600" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{loc.name}</h3>
                            {loc.is_primary && (
                              <Badge variant="secondary" className="text-xs">Main</Badge>
                            )}
                          </div>
                          {loc.address_line1 && (
                            <p className="text-sm text-muted-foreground">
                              {[loc.address_line1, loc.city, loc.postal_code].filter(Boolean).join(", ")}
                            </p>
                          )}
                          {loc.phone && (
                            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Phone className="h-3 w-3" />{loc.phone}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            {/* Book CTA */}
            <Card className="border-sky-200 bg-sky-50">
              <CardContent className="p-5 space-y-3 text-center">
                <p className="font-semibold text-sky-900">Book an Appointment</p>
                <p className="text-sm text-sky-700">
                  Same-day and next-day appointments available.
                </p>
                {allDoctors.length > 0 ? (
                  <Link href={`/${locale}/doctors?clinic=${slug}`}>
                    <Button className="w-full">View All Doctors</Button>
                  </Link>
                ) : (
                  <Button className="w-full" disabled>Coming Soon</Button>
                )}
              </CardContent>
            </Card>

            {/* Contact */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <p className="font-semibold">Contact</p>
                {org.phone && (
                  <a href={`tel:${org.phone}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-600">
                    <Phone className="h-4 w-4" />{org.phone}
                  </a>
                )}
                {org.email && (
                  <a href={`mailto:${org.email}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-600">
                    <Mail className="h-4 w-4" />{org.email}
                  </a>
                )}
                {org.website && (
                  <a
                    href={org.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-sky-600"
                  >
                    <Globe className="h-4 w-4" />Visit website
                  </a>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <p className="font-semibold">At a Glance</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Doctors</span>
                    <span className="font-medium">{allDoctors.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Locations</span>
                    <span className="font-medium">{locations.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>
    </>
  );
}
