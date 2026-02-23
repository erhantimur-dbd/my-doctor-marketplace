export function doctorJsonLd({
  name,
  specialty,
  image,
  rating,
  reviewCount,
  address,
  url,
}: {
  name: string;
  specialty?: string;
  image?: string;
  rating?: number;
  reviewCount?: number;
  address?: { city?: string; country?: string };
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "Physician",
    name,
    ...(specialty && { medicalSpecialty: specialty }),
    ...(image && { image }),
    ...(rating && reviewCount && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: rating,
        reviewCount,
        bestRating: 5,
      },
    }),
    ...(address && {
      address: {
        "@type": "PostalAddress",
        ...(address.city && { addressLocality: address.city }),
        ...(address.country && { addressCountry: address.country }),
      },
    }),
    url,
  };
}

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "MyDoctor",
    description: "Premium private healthcare marketplace connecting patients with verified specialists across Europe.",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://mydoctor.com",
    logo: `${process.env.NEXT_PUBLIC_APP_URL || "https://mydoctor.com"}/logo.png`,
  };
}
