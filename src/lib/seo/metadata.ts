import type { Metadata } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://mydoctor.com";

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
    title: `${title} | MyDoctor`,
    description,
    ...(noIndex && { robots: { index: false, follow: false } }),
    openGraph: {
      title: `${title} | MyDoctor`,
      description,
      url,
      siteName: "MyDoctor",
      type: "website",
      ...(image && { images: [{ url: image, width: 1200, height: 630 }] }),
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | MyDoctor`,
      description,
      ...(image && { images: [image] }),
    },
    alternates: {
      canonical: url,
    },
  };
}
