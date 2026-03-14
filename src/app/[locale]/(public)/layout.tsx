import { Header } from "@/components/layout/dynamic-header";
import { Footer } from "@/components/layout/footer";
import { BackToTop } from "@/components/shared/back-to-top";

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
    </div>
  );
}
