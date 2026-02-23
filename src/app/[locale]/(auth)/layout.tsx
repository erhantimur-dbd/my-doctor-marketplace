import { Stethoscope } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 px-4">
      <Link href="/" className="mb-8 flex items-center gap-2">
        <Stethoscope className="h-8 w-8 text-primary" />
        <span className="text-2xl font-bold tracking-tight">MyDoctor</span>
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
