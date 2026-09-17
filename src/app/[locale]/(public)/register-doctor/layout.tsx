import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Founding Doctor Programme",
  description:
    "Register as a founding doctor. Founding Free is a lifetime Solo Professional equivalent (value £299/mo) at £0 — no card required.",
};

export default function RegisterDoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
