import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Heart,
  Sparkles,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  ArrowRight,
} from "lucide-react";
import { getSpecialtyColor } from "@/lib/constants/specialty-colors";

const iconMap: Record<string, React.ElementType> = {
  Stethoscope,
  Heart,
  Sparkles,
  Brain,
  Eye,
  Smile,
  Baby,
  Activity,
  Wind,
  Shield,
  Apple,
  Droplets,
  Ear,
  Flower,
  Scan,
  Bone: Activity,
  HeartHandshake: Heart,
};

const allSpecialties = [
  { slug: "general-practice", icon: "Stethoscope", key: "general_practice", desc: "Primary care, check-ups, and general health concerns" },
  { slug: "cardiology", icon: "Heart", key: "cardiology", desc: "Heart and cardiovascular system specialists" },
  { slug: "dermatology", icon: "Sparkles", key: "dermatology", desc: "Skin, hair, and nail conditions" },
  { slug: "orthopedics", icon: "Bone", key: "orthopedics", desc: "Bones, joints, muscles, and ligaments" },
  { slug: "neurology", icon: "Brain", key: "neurology", desc: "Brain, spinal cord, and nervous system" },
  { slug: "psychiatry", icon: "Brain", key: "psychiatry", desc: "Mental health diagnosis and medication management" },
  { slug: "psychology", icon: "HeartHandshake", key: "psychology", desc: "Therapy, counseling, and behavioral health" },
  { slug: "ophthalmology", icon: "Eye", key: "ophthalmology", desc: "Eye care, vision, and eye surgery" },
  { slug: "ent", icon: "Ear", key: "ent", desc: "Ear, nose, and throat conditions" },
  { slug: "gynecology", icon: "Baby", key: "gynecology", desc: "Women's reproductive health and obstetrics" },
  { slug: "urology", icon: "Activity", key: "urology", desc: "Urinary tract and male reproductive system" },
  { slug: "gastroenterology", icon: "Apple", key: "gastroenterology", desc: "Digestive system and gastrointestinal tract" },
  { slug: "endocrinology", icon: "Droplets", key: "endocrinology", desc: "Hormones, diabetes, and metabolic disorders" },
  { slug: "pulmonology", icon: "Wind", key: "pulmonology", desc: "Lungs and respiratory system" },
  { slug: "oncology", icon: "Shield", key: "oncology", desc: "Cancer diagnosis, treatment, and care" },
  { slug: "pediatrics", icon: "Baby", key: "pediatrics", desc: "Medical care for infants, children, and adolescents" },
  { slug: "dentistry", icon: "Smile", key: "dentistry", desc: "Teeth, gums, and oral health" },
  { slug: "aesthetic-medicine", icon: "Sparkles", key: "aesthetic_medicine", desc: "Cosmetic procedures and aesthetic treatments" },
  { slug: "physiotherapy", icon: "Activity", key: "physiotherapy", desc: "Physical rehabilitation and movement therapy" },
  { slug: "radiology", icon: "Scan", key: "radiology", desc: "Medical imaging and diagnostic scans" },
  { slug: "nutrition", icon: "Apple", key: "nutrition", desc: "Diet, nutrition planning, and weight management" },
  { slug: "allergy", icon: "Flower", key: "allergy", desc: "Allergies, asthma, and immune system disorders" },
  { slug: "rheumatology", icon: "Bone", key: "rheumatology", desc: "Autoimmune diseases and joint disorders" },
  { slug: "nephrology", icon: "Droplets", key: "nephrology", desc: "Kidney health and renal diseases" },
];

export default function SpecialtiesPage() {
  const t = useTranslations("specialty");

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-br from-primary/5 via-background to-primary/5 px-4 py-16 md:py-24">
        <div className="container mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            24 Medical Specialties
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight md:text-5xl">
            Browse All Specialties
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Find the right specialist for your needs. All our doctors are verified and offer transparent pricing with instant online booking.
          </p>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="px-4 py-12 md:py-20">
        <div className="container mx-auto">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {allSpecialties.map((spec) => {
              const Icon = iconMap[spec.icon] || Stethoscope;
              const c = getSpecialtyColor(spec.slug);
              return (
                <Link key={spec.slug} href={`/doctors?specialty=${spec.slug}`}>
                  <Card className={`group h-full cursor-pointer transition-all ${c.border} hover:shadow-md`}>
                    <CardContent className="flex items-start gap-4 p-5">
                      <div className={`shrink-0 rounded-xl ${c.bg} p-3 transition-colors ${c.hoverBg}`}>
                        <Icon className={`h-6 w-6 ${c.text}`} />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold">{t(spec.key)}</h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {spec.desc}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-muted/30 px-4 py-12 md:py-20">
        <div className="container mx-auto text-center">
          <h2 className="text-2xl font-bold md:text-3xl">
            Not sure which specialist you need?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Start with a General Practice consultation. Your GP can assess your condition and refer you to the right specialist if needed.
          </p>
          <Button size="lg" className="mt-8 rounded-full" asChild>
            <Link href="/doctors?specialty=general-practice">
              Find a General Practitioner <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
