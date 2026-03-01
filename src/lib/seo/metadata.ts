import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctors360.com";

interface GenerateMetadataParams {
  title: string;
  description: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}

export function generateMetadata({
  title,
  description,
  path = "",
  image,
  noIndex = false,
}: GenerateMetadataParams): Metadata {
  const url = `${BASE_URL}${path}`;

  return {
    title: `${title} | MyDoctors360`,
    description,
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title: `${title} | MyDoctors360`,
      description,
      url,
      siteName: "MyDoctors360",
      type: "website",
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | MyDoctors360`,
      description,
      ...(image && { images: [image] }),
    },
    alternates: {
      canonical: url,
    },
  };
}
