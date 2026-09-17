import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyDoctors360 — Founding Doctor Programme",
    template: "%s | MyDoctors360",
  },
  description:
    "MyDoctors360 is launching soon across the UK and Europe. Join the Founding Doctor Programme — exclusive perks and pricing locked in for the first 100 doctors.",
  openGraph: {
    title: "MyDoctors360 — Founding Doctor Programme",
    description:
      "A modern private practice platform for UK and European doctors. First 100 founding doctors — exclusive founding pricing and perks.",
    siteName: "MyDoctors360",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MyDoctors360 — Founding Doctor Programme",
    description:
      "A modern private practice platform for UK and European doctors. First 100 founding doctors — exclusive founding pricing and perks.",
  },
  verification: {
    google: "EdM0owW0expdv2fT1tiUvYx9ibGdw3FW_k7489bQRmE",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
