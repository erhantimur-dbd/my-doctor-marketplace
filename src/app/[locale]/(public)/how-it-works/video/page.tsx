import { InstagramAnimation } from "@/components/how-it-works/instagram-animation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works - Video",
  robots: { index: false, follow: false },
};

export default function HowItWorksVideoPage() {
  return (
    <div className="fixed inset-0 z-[9999] bg-white">
      <InstagramAnimation />
    </div>
  );
}
