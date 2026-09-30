import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Join the Founding Doctor Programme",
  description:
    "Register as a founding doctor. £99 per month for the first 100 doctors. Monthly, cancel anytime. The price stays £99 while you keep the plan.",
};

export default function RegisterDoctorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
