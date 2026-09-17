import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Founding Doctor Programme",
  description:
    "Register as a founding doctor. Founding Free is £0 — no card required. Build your profile now; patient booking opens at public launch.",
};

export default function RegisterDoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
