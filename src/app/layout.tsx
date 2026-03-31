import type { Metadata } from "next";
import { organizationJsonLd } from "@/lib/seo/json-ld";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyDoctors360 - Premium Private Healthcare Marketplace",
    template: "%s | MyDoctors360",
  },
  description:
    "Find verified private doctors, book instantly, and receive premium healthcare. Transparent pricing across Europe.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

const orgJsonLd = organizationJsonLd();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
      />
      {children}
    </>
  );
}
