import { Card, CardContent } from "@/components/ui/card";

/**
 * UK Privacy Policy — served on `mydoctors360.co.uk` only.
 *
 * This variant adds UK-specific material the default cannot carry without
 * misrepresenting our position: the ICO registration number, the DPO contact,
 * the joint-controller note for clinical records, the explicit Article 6 / 9
 * bases for each processing purpose, the full sub-processor list with DPA
 * links, and the UK international-transfers basis (UK IDTA / Data Bridge).
 *
 * Must be signed off by a UK healthcare regulatory solicitor before
 * publication. Do NOT publish with any "TBD_" placeholder still in place —
 * each TBD represents data the user owes us before go-live.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name (e.g. "MyDoctors360 Ltd")
 *   - Companies House number
 *   - Registered office address
 *   - ICO data controller registration number
 *   - DPO name + contact (or named privacy lead)
 *   - Data controller vs processor designation per data type (if any
 *     adjustments are needed beyond the defaults below)
 */

const EFFECTIVE_DATE = "17 March 2026";
const COMPANY = "MyDoctors360";

const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPANIES_HOUSE_NUMBER = "TBD_COMPANIES_HOUSE_NUMBER";
const REGISTERED_OFFICE = "TBD_REGISTERED_OFFICE_ADDRESS";
const ICO_REGISTRATION_NUMBER = "TBD_ICO_REGISTRATION_NUMBER";
const DPO_NAME = "TBD_DPO_NAME_OR_PRIVACY_LEAD";
const DPO_EMAIL = "TBD_DPO_EMAIL";

export function PrivacyUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Privacy Policy (United Kingdom)</h1>
        <p className="mt-2 text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>1. Introduction</h2>
          <p>
            {COMPANY} is operated in the United Kingdom by {LEGAL_ENTITY} (company number{" "}
            {COMPANIES_HOUSE_NUMBER}, registered office {REGISTERED_OFFICE}). This Privacy Policy
            explains how we collect, use, store, and protect your personal data under the UK
            General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018. It
            also explains how we fit alongside the doctor you book with, who is separately
            responsible for their own clinical records.
          </p>

          <h2>2. Who We Are &amp; Our Registrations</h2>
          <ul>
            <li>
              <strong>Legal entity:</strong> {LEGAL_ENTITY}
            </li>
            <li>
              <strong>Companies House number:</strong> {COMPANIES_HOUSE_NUMBER}
            </li>
            <li>
              <strong>Registered office:</strong> {REGISTERED_OFFICE}
            </li>
            <li>
              <strong>ICO data controller registration number:</strong> {ICO_REGISTRATION_NUMBER}
            </li>
            <li>
              <strong>Data Protection Lead:</strong> {DPO_NAME} — {DPO_EMAIL}
            </li>
          </ul>

          <h2>3. Controller / Processor Split</h2>
          <p>
            {COMPANY} is a technology intermediary, not a healthcare provider. That distinction
            matters for data protection:
          </p>
          <ul>
            <li>
              <strong>For your account, booking, and payment data,</strong> {LEGAL_ENTITY} acts as{" "}
              <strong>data controller</strong>. We decide how and why this data is used.
            </li>
            <li>
              <strong>For clinical records authored by the doctor</strong> (prescriptions, care
              plans, consultation notes written by the treating doctor during or after your
              appointment), the doctor is the data controller for their own patient record, and{" "}
              {LEGAL_ENTITY} acts as <strong>data processor</strong> on the doctor&rsquo;s behalf —
              we host and transmit that record under instruction from the doctor.
            </li>
            <li>
              <strong>For intake information you enter into your medical profile and choose to
              share with a particular doctor</strong>, we and the doctor act as{" "}
              <strong>joint controllers</strong> for that limited dataset during the booking.
              We are responsible for collecting and transmitting it securely; the doctor is
              responsible for reading it, acting on it, and retaining it per their own
              obligations.
            </li>
          </ul>
          <p>
            We provide each doctor with a Data Processing Agreement at onboarding that documents
            this split. You can request a copy at {DPO_EMAIL}.
          </p>

          <h2>4. Data We Collect</h2>
          <h3>4.1 Account Information</h3>
          <p>Name, email address, phone number, and password (hashed) when you create an account.</p>

          <h3>4.2 Intake &amp; Medical Information</h3>
          <p>
            Health conditions, allergies, medications, blood type, and other intake information
            you voluntarily provide in your medical profile, and any symptoms you describe at the
            time of booking. Under UK GDPR this is <em>special category data</em> (Article 9).
          </p>

          <h3>4.3 Booking, Payment &amp; Communication Data</h3>
          <p>
            Appointment details, messages exchanged with your doctor through the platform, and
            payment information processed via Stripe. We do not store full card numbers; Stripe
            does, under PCI-DSS Level 1 certification.
          </p>

          <h3>4.4 Consultation Content</h3>
          <p>
            Where the doctor uses platform-hosted video for your consultation, the video call is
            transmitted but <strong>not recorded or stored</strong> by us. Any clinical notes
            generated by the doctor during or after the consultation are stored by us as processor
            on the doctor&rsquo;s behalf (see §3).
          </p>

          <h3>4.5 Technical Data</h3>
          <p>
            IP address, browser type, device information, and usage analytics (subject to your
            cookie preferences — see our{" "}
            <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a>).
          </p>

          <h2>5. Legal Bases for Processing</h2>
          <p>For each category of data, we rely on one or more of the following bases:</p>
          <ul>
            <li>
              <strong>Contract performance — UK GDPR Art 6(1)(b).</strong> To create your account,
              run searches, take bookings, process payments, send confirmations, and deliver
              messaging between you and the doctor.
            </li>
            <li>
              <strong>Legitimate interests — UK GDPR Art 6(1)(f).</strong> For platform security,
              fraud prevention, abuse monitoring, and service improvement. We have balanced these
              interests against your rights and can share our Legitimate Interests Assessment on
              request.
            </li>
            <li>
              <strong>Legal obligation — UK GDPR Art 6(1)(c).</strong> For accounting, tax, and
              responding to lawful requests from competent authorities.
            </li>
            <li>
              <strong>Explicit consent — UK GDPR Art 9(2)(a).</strong> For collecting and
              transmitting health data you enter into your medical profile and choose to share
              with a specific doctor.
            </li>
            <li>
              <strong>Provision of healthcare — UK GDPR Art 9(2)(h).</strong> When processing
              clinical-record data on behalf of the treating doctor (as processor — see §3), the
              underlying basis the doctor relies on is the provision of healthcare under the
              responsibility of a health professional.
            </li>
          </ul>

          <h2>6. How We Use Your Data</h2>
          <ul>
            <li>Help you find and book appointments with independent private doctors.</li>
            <li>Process payments via Stripe Connect (we act as the doctor&rsquo;s payment agent).</li>
            <li>Send appointment reminders, confirmations, and service messages.</li>
            <li>
              Transmit your intake data to the doctor you choose — and only to that doctor — so
              they can prepare for your consultation.
            </li>
            <li>
              Host the technical infrastructure (messaging, video rooms, document storage) that
              the doctor uses to deliver care to you.
            </li>
            <li>Improve the platform, investigate safety incidents, and respond to support queries.</li>
          </ul>

          <h2>7. Who We Share Data With (Sub-processors)</h2>
          <p>
            We use the following sub-processors. Each has its own data-protection commitments
            and each handles data only under our written instruction. We review this list
            periodically; material changes will be notified to you.
          </p>
          <ul>
            <li>
              <strong>Stripe (payments)</strong> — processes card details and payouts.{" "}
              <a href="https://stripe.com/privacy" className="text-primary hover:underline">
                stripe.com/privacy
              </a>
            </li>
            <li>
              <strong>Supabase (database &amp; file storage)</strong> — stores account records,
              bookings, messages, and documents. EU region.{" "}
              <a href="https://supabase.com/privacy" className="text-primary hover:underline">
                supabase.com/privacy
              </a>
            </li>
            <li>
              <strong>Vercel (hosting)</strong> — runs the web application.{" "}
              <a href="https://vercel.com/legal/privacy-policy" className="text-primary hover:underline">
                vercel.com/legal/privacy-policy
              </a>
            </li>
            <li>
              <strong>Resend (transactional email)</strong> — sends booking confirmations and
              reminders.{" "}
              <a href="https://resend.com/legal/privacy-policy" className="text-primary hover:underline">
                resend.com/legal/privacy-policy
              </a>
            </li>
            <li>
              <strong>Daily.co (video consultations)</strong> — transmits video consultations.
              Calls are not recorded by the platform.{" "}
              <a href="https://www.daily.co/legal/privacy/" className="text-primary hover:underline">
                daily.co/legal/privacy
              </a>
            </li>
            <li>
              <strong>Twilio (SMS reminders)</strong> — sends text-message reminders.{" "}
              <a href="https://www.twilio.com/en-us/legal/privacy" className="text-primary hover:underline">
                twilio.com/legal/privacy
              </a>
            </li>
            <li>
              <strong>Meta WhatsApp Business (optional reminders)</strong> — sends WhatsApp
              reminders where you&rsquo;ve opted in.{" "}
              <a href="https://www.whatsapp.com/legal/business-terms" className="text-primary hover:underline">
                whatsapp.com/legal/business-terms
              </a>
            </li>
            <li>
              <strong>OpenAI (specialty routing)</strong> — used only for the specialty finder,
              which does not return a diagnosis. Inputs are not used to train models.{" "}
              <a href="https://openai.com/policies/privacy-policy" className="text-primary hover:underline">
                openai.com/policies/privacy-policy
              </a>
            </li>
            <li>
              <strong>Sentry (error monitoring)</strong> — captures anonymised error reports.{" "}
              <a href="https://sentry.io/privacy/" className="text-primary hover:underline">
                sentry.io/privacy
              </a>
            </li>
            <li>
              <strong>Google (Places, Calendar)</strong> — location autocomplete and calendar
              sync.{" "}
              <a href="https://policies.google.com/privacy" className="text-primary hover:underline">
                policies.google.com/privacy
              </a>
            </li>
          </ul>
          <p>
            In addition, we share booking and intake data with{" "}
            <strong>the doctor you book with</strong> — that is the whole point of the platform.
            Each doctor is the independent controller of any clinical record they create for you
            after the consultation (see §3).
          </p>
          <p>We do not sell your data to third parties.</p>

          <h2>8. International Transfers</h2>
          <p>
            Your data is primarily stored in the UK or EEA. Some sub-processors above (Stripe,
            Vercel, Sentry, OpenAI, Daily.co, Twilio) process or route data through the United
            States. Where that happens, we rely on one or more of the following safeguards:
          </p>
          <ul>
            <li>
              The <strong>UK Extension to the EU-US Data Privacy Framework</strong> (UK-US Data
              Bridge) where the sub-processor is self-certified.
            </li>
            <li>
              The <strong>UK International Data Transfer Agreement (IDTA)</strong> or the EU
              Standard Contractual Clauses with the UK Addendum otherwise.
            </li>
          </ul>
          <p>
            A copy of the relevant safeguards is available from {DPO_EMAIL} on request.
          </p>

          <h2>9. Data Retention</h2>
          <ul>
            <li>
              <strong>Account data</strong> — Retained while your account is active, deleted on
              account deletion request.
            </li>
            <li>
              <strong>Booking records</strong> — Retained for <strong>8 years</strong> after the
              appointment (aligned with NHS Records Management Code of Practice retention for
              adult records).
            </li>
            <li>
              <strong>Medical / intake data</strong> — Retained for 8 years from the last
              consultation, or until you request erasure. Note that where the doctor is the
              controller of a clinical record (see §3), the doctor&rsquo;s own retention schedule
              applies and we process per their instruction.
            </li>
            <li>
              <strong>Payment records</strong> — Retained for 7 years (HMRC tax obligation).
            </li>
            <li>
              <strong>Audit logs</strong> — Retained for 2 years for security and fraud-prevention
              purposes.
            </li>
            <li>
              <strong>Pending bookings</strong> — Automatically deleted after 15 minutes (patient)
              or 48 hours (admin-created) if payment is not completed.
            </li>
          </ul>

          <h2>10. Your Rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul>
            <li><strong>Access</strong> your personal data — available in Dashboard &gt; Settings &gt; Export Data, or by written request.</li>
            <li><strong>Rectification</strong> — correct inaccurate data via your profile settings or by written request.</li>
            <li><strong>Erasure</strong> — delete your account (Dashboard &gt; Settings &gt; Delete Account). Note: some booking and payment records are retained under the legal-obligation basis in §9.</li>
            <li><strong>Restrict processing</strong> — contact {DPO_EMAIL} to limit how we use your data.</li>
            <li><strong>Data portability</strong> — export your data in a structured, machine-readable format.</li>
            <li><strong>Object</strong> — to processing based on legitimate interests.</li>
            <li><strong>Withdraw consent</strong> — for medical data sharing at any time, without affecting processing already carried out.</li>
            <li>
              <strong>Access to Health Records Act 1990</strong> — if you need access to clinical
              records authored by a specific doctor, please contact that doctor directly; they
              are the controller of that record.
            </li>
          </ul>

          <h2>11. Data Subject Access Requests (DSAR)</h2>
          <p>
            To exercise any of the rights listed above, email {DPO_EMAIL} with the subject line
            &ldquo;Data Subject Access Request&rdquo;. Please include your full name, the email
            address on your account, and a description of your request.
          </p>
          <p>
            We respond within <strong>30 calendar days</strong> (UK GDPR Art 12). In complex
            cases or where we receive a high volume of requests, we may extend this by a further
            60 days and will tell you within the initial 30-day period if so. Identity
            verification may be requested. Requests are free of charge except where manifestly
            unfounded or excessive (UK GDPR Art 12(5)).
          </p>

          <h2>12. Cookies</h2>
          <p>
            We use essential cookies for authentication and optional analytics cookies under the
            Privacy and Electronic Communications Regulations 2003 (PECR). Non-essential cookies
            are set only after you give consent. See our{" "}
            <a href="/cookie-policy" className="text-primary hover:underline">Cookie Policy</a>{" "}
            for the full inventory.
          </p>

          <h2>13. Security</h2>
          <p>
            We protect your data with HTTPS/TLS encryption in transit, row-level security policies
            in the database, encrypted storage for documents, multi-factor authentication options,
            and a documented incident-response process. We will notify affected individuals and
            the ICO within 72 hours of becoming aware of a personal-data breach where the breach
            is likely to result in a risk to your rights and freedoms.
          </p>

          <h2>14. Children</h2>
          <p>
            The platform is not directed to individuals under 16. We do not knowingly collect
            data from children. If you believe a child has registered, please contact{" "}
            {DPO_EMAIL}.
          </p>

          <h2>15. Changes to This Policy</h2>
          <p>
            We may update this policy periodically. Material changes will be notified by email or
            in-app notification. Continued use after changes constitutes acceptance.
          </p>

          <h2>16. Contact &amp; Complaints</h2>
          <p>
            <strong>Data Protection Lead:</strong> {DPO_NAME} — {DPO_EMAIL}
            <br />
            <strong>General privacy queries:</strong> privacy@mydoctors360.com
          </p>
          <p>
            You have the right to lodge a complaint with the Information Commissioner&rsquo;s
            Office (ICO). You can reach the ICO at{" "}
            <a href="https://ico.org.uk" className="text-primary hover:underline">ico.org.uk</a>,
            by phone on 0303 123 1113, or by post at: Information Commissioner&rsquo;s Office,
            Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF.
          </p>
          <p>
            We would appreciate the chance to deal with your concerns first, so please contact
            us at {DPO_EMAIL} before raising a complaint with the ICO.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
