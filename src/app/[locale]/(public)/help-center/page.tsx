import type { Metadata } from "next";
import { HelpCenterClient } from "@/components/help-center/help-center-client";

export const metadata: Metadata = {
  title: "Help Center — MyDoctors360",
  description:
    "Find guides, troubleshooting tips, and answers to common questions about booking, calendar sync, payments, and more on MyDoctors360.",
};

export default function HelpCenterPage() {
  return <HelpCenterClient />;
}
