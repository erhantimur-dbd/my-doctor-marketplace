import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Privacy Policy | MyDoctors360",
  description: "Privacy policy for MyDoctors360 healthcare marketplace.",
};

const EFFECTIVE_DATE = "17 March 2026";
const COMPANY = "MyDoctors360";

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
        <p className="mt-2 text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>1. Introduction</h2>
          <p>
            {COMPANY} (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) operates a healthcare marketplace
            connecting patients with private medical practitioners. This Privacy Policy explains how we collect,
            use, store, and protect your personal data in compliance with the UK General Data Protection Regulation
            (UK GDPR) and the Data Protection Act 2018.
          </p>

          <h2>2. Data Controller</h2>
          <p>
            {COMPANY} is the data controller for personal data processed through our platform.
            For questions about this policy, contact us at <strong>privacy@mydoctors360.com</strong>.
          </p>

          <h2>3. Data We Collect</h2>
          <h3>3.1 Account Information</h3>
          <p>Name, email address, phone number, and password (hashed) when you create an account.</p>

          <h3>3.2 Medical Information</h3>
          <p>
            Health conditions, allergies, medications, blood type, and other medical information you
            voluntarily provide in your medical profile or during consultations. This constitutes
            &ldquo;special category data&rdquo; under UK GDPR.
          </p>

          <h3>3.3 Booking &amp; Payment Data</h3>
          <p>
            Appointment details, consultation notes, and payment information processed securely via Stripe.
            We do not store full credit card numbers on our servers.
          </p>

          <h3>3.4 Technical Data</h3>
          <p>
            IP address, browser type, device information, and usage analytics (subject to your cookie preferences).
          </p>

          <h2>4. Legal Basis for Processing</h2>
          <ul>
            <li><strong>Contract performance</strong> — To provide our booking and marketplace services.</li>
            <li><strong>Explicit consent</strong> — For processing medical/health data (Article 9(2)(a) UK GDPR).</li>
            <li><strong>Legitimate interests</strong> — For platform security, fraud prevention, and service improvement.</li>
            <li><strong>Legal obligation</strong> — To comply with healthcare regulations and tax requirements.</li>
          </ul>

          <h2>5. How We Use Your Data</h2>
          <ul>
            <li>Facilitate appointment bookings between patients and doctors.</li>
            <li>Process payments via Stripe Connect.</li>
            <li>Send appointment reminders and booking confirmations.</li>
            <li>Enable doctors to provide medical care with your health context (with your consent).</li>
            <li>Improve our platform and resolve support queries.</li>
          </ul>

          <h2>6. Data Sharing</h2>
          <p>We share your data only with:</p>
          <ul>
            <li><strong>Healthcare providers</strong> — Doctors you book with (medical profile shared only with your explicit consent).</li>
            <li><strong>Stripe</strong> — Payment processing (PCI DSS compliant).</li>
            <li><strong>Resend</strong> — Email delivery service.</li>
            <li><strong>Supabase</strong> — Database hosting (EU/UK data centres).</li>
            <li><strong>Sentry</strong> — Error monitoring (anonymised data only).</li>
          </ul>
          <p>We do not sell your data to third parties.</p>

          <h2>7. Data Retention</h2>
          <ul>
            <li><strong>Account data</strong> — Retained while your account is active, deleted on account deletion.</li>
            <li><strong>Booking records</strong> — Retained for 8 years (UK medical records retention requirement).</li>
            <li><strong>Medical data</strong> — Retained for 8 years from last interaction, or until you request deletion.</li>
            <li><strong>Payment records</strong> — Retained for 7 years (tax obligations).</li>
            <li><strong>Pending bookings</strong> — Automatically deleted after 15 minutes (patient) or 48 hours (admin-created) if payment is not completed.</li>
          </ul>

          <h2>8. Your Rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access</strong> your personal data (available via Dashboard &gt; Settings &gt; Export Data).</li>
            <li><strong>Rectification</strong> — correct inaccurate data via your profile settings.</li>
            <li><strong>Erasure</strong> — delete your account (Dashboard &gt; Settings &gt; Delete Account).</li>
            <li><strong>Restrict processing</strong> — contact us to limit how we use your data.</li>
            <li><strong>Data portability</strong> — export your data in JSON format.</li>
            <li><strong>Object</strong> — to processing based on legitimate interests.</li>
            <li><strong>Withdraw consent</strong> — for medical data sharing at any time.</li>
          </ul>

          <h2>9. Cookies</h2>
          <p>
            We use essential cookies for authentication and optional analytics cookies (subject to your consent).
            See our cookie consent banner for granular control.
          </p>

          <h2>10. Security</h2>
          <p>
            We protect your data with HTTPS/TLS encryption in transit, row-level security policies in our
            database, multi-factor authentication options, and regular security audits.
          </p>

          <h2>11. International Transfers</h2>
          <p>
            Your data is primarily stored in the EU/UK. Where transfers outside the UK are necessary
            (e.g., for email delivery), we ensure adequate safeguards are in place under UK GDPR.
          </p>

          <h2>12. Children</h2>
          <p>
            Our services are not directed to individuals under 16. We do not knowingly collect data from children.
          </p>

          <h2>13. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. Significant changes will be notified via email or in-app notification.
            Continued use after changes constitutes acceptance.
          </p>

          <h2>14. Contact &amp; Complaints</h2>
          <p>
            For privacy queries: <strong>privacy@mydoctors360.com</strong>
          </p>
          <p>
            You have the right to lodge a complaint with the Information Commissioner&apos;s Office (ICO)
            at <strong>ico.org.uk</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
