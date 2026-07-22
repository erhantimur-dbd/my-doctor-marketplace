import { Header } from "@/components/layout/dynamic-header";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/shared/back-to-top";
import { ChatWidget } from "@/components/chat/chat-widget";
import { FloatingMic } from "@/components/voice/floating-mic";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <BackToTop />
      <ChatWidget />
      {/* Voice AI Phase 1 — Grok Voice STT/TTS + privacy notice; never auto-books */}
      <FloatingMic />
    </div>
  );
}
