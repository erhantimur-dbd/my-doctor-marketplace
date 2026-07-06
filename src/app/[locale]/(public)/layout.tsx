import { Header } from "@/components/layout/dynamic-header";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/shared/back-to-top";
import { SkipLink } from "@/components/shared/skip-link";
import { ChatWidget } from "@/components/chat/chat-widget";

export default async function PublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <div className="flex min-h-screen flex-col">
      <SkipLink />
      <Header />
      <main id="main-content" tabIndex={-1} className="flex-1">
        {children}
      </main>
      <Footer locale={locale} />
      <BackToTop />
      <ChatWidget />
    </div>
  );
}
