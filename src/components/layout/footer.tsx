import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Stethoscope } from "lucide-react";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Stethoscope className="h-6 w-6 text-primary" />
              <span className="text-lg font-bold">MyDoctor</span>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              Premium private healthcare marketplace connecting patients with
              verified specialists across Europe.
            </p>
          </div>

          {/* Patients */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">For Patients</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/doctors" className="hover:text-foreground">
                  Find a Doctor
                </Link>
              </li>
              <li>
                <Link href="/specialties" className="hover:text-foreground">
                  Specialties
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-foreground">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-foreground">
                  Support
                </Link>
              </li>
              <li>
                <Link href="/find-pharmacy" className="hover:text-foreground">
                  Find a Pharmacy
                </Link>
              </li>
            </ul>
          </div>

          {/* Doctors */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t("for_doctors")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/register-doctor" className="hover:text-foreground">
                  Join as Doctor
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  {t("contact")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  {t("terms")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-foreground">
                  {t("about")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} MyDoctor. {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
