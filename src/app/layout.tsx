import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyDoctors360 - Premium Private Healthcare Marketplace",
    template: "%s | MyDoctors360",
  },
  description:
    "Find verified private doctors, book instantly, and receive premium healthcare. Transparent pricing across Europe.",
  verification: {
    google: "EdM0owW0expdv2fT1tiUvYx9ibGdw3FW_k7489bQRmE",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
