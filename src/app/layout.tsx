import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MyDoctor - Premium Private Healthcare Marketplace",
    template: "%s | MyDoctor",
  },
  description:
    "Find verified private doctors, book instantly, and receive premium healthcare. Transparent pricing across Europe.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
