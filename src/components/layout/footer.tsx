import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/brand/logo";
import { PaymentIcons } from "@/components/brand/payment-icons";

export function Footer() {
  const t = useTranslations("footer");

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2">
              <Logo className="h-6 w-6 text-primary" />
              <div className="flex flex-col">
                <span className="text-lg font-bold leading-tight">MyDoctors360</span>
                <span className="text-[10px] text-muted-foreground">{t("brand_tagline")}</span>
              </div>
            </Link>
            <p className="mt-3 text-sm text-muted-foreground">
              {t("brand_description")}
            </p>
          </div>

          {/* Patients */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t("for_patients")}</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/doctors" className="hover:text-foreground">
                  {t("find_doctor")}
                </Link>
              </li>
              <li>
                <Link href="/specialties" className="hover:text-foreground">
                  {t("specialties")}
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="hover:text-foreground">
                  {t("how_it_works")}
                </Link>
              </li>
              <li>
                <Link href="/support" className="hover:text-foreground">
                  {t("support")}
                </Link>
              </li>
              <li>
                <Link href="/help-center" className="hover:text-foreground">
                  {t("help_center")}
                </Link>
              </li>
              <li>
                <Link href="/find-pharmacy" className="hover:text-foreground">
                  {t("find_pharmacy")}
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
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
                  {t("pricing")}
                </Link>
              </li>
              <li>
                <Link href="/register-doctor" className="hover:text-foreground">
                  {t("join_as_doctor")}
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-foreground">
                  {t("contact")}
                </Link>
              </li>
              <li>
                <Link href="/help-center" className="hover:text-foreground">
                  {t("help_center")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal + Payment methods */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">{t("legal")}</h4>
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

            <div className="mt-6">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("payment_methods")}
              </p>
              <PaymentIcons />
            </div>
          </div>
        </div>

        <div className="mt-6 border-t pt-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} MyDoctors360. {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
