import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Founding Doctor Programme",
  description:
    "Register as a founding doctor. Founding Free includes Professional features for life (£299/mo value) — £0, no card required.",
};

export default function RegisterDoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
