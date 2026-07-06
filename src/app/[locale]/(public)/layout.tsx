import { Header } from "@/components/layout/dynamic-header";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/shared/back-to-top";
import { SkipLink } from "@/components/shared/skip-link";
import { ChatWidget } from "@/components/chat/chat-widget";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer />
      <BackToTop />
      <ChatWidget />
    </div>
  );
}
