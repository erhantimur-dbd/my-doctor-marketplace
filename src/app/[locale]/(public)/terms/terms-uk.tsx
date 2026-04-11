import { Card, CardContent } from "@/components/ui/card";

/**
 * UK Terms of Service — served on `mydoctors360.co.uk` only.
 *
 * This variant reframes the service as a technology intermediary (booking,
 * payments, communications) rather than a healthcare provider. The framing
 * is deliberate: carrying on a "regulated activity" under the Health and
 * Social Care Act 2008 without CQC registration is a criminal offence, and
 * the individual-practitioner exemption cannot be used by companies. So
 * MyDoctors360 Ltd must be positioned unambiguously as a non-clinical
 * facilitator, and each listed doctor must evidence their own CQC status.
 *
 * This file should be reviewed by a UK healthcare regulatory solicitor
 * before it goes live to real patients. Do NOT publish with TBD values.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name (e.g. "MyDoctors360 Ltd")
 *   - Companies House number
 *   - Registered office address
 *   - Complaints handler email
 */

const EFFECTIVE_DATE = "17 March 2026";
const COMPANY = "MyDoctors360";

// TBD — replace before publishing. Leaving real placeholders so a grep for
// "TBD_" will catch anything that slipped through.
const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPANIES_HOUSE_NUMBER = "TBD_COMPANIES_HOUSE_NUMBER";
const REGISTERED_OFFICE = "TBD_REGISTERED_OFFICE_ADDRESS";
const COMPLAINTS_EMAIL = "TBD_COMPLAINTS_EMAIL";

export function TermsUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Terms of Service (United Kingdom)</h1>
        <p className="mt-2 text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>1. Introduction</h2>
          <p>
            Welcome to {COMPANY}. These Terms of Service (&ldquo;Terms&rdquo;) govern your use of our
            technology platform in the United Kingdom. The platform is operated by {LEGAL_ENTITY}
            (company number {COMPANIES_HOUSE_NUMBER}), with registered office at {REGISTERED_OFFICE}.
            By creating an account or using the platform you agree to be bound by these Terms.
          </p>

          <h2>2. Platform Description — We Are a Technology Intermediary</h2>
          <p>
            {COMPANY} is a <strong>technology platform</strong> that helps patients find and book
            appointments with independent private doctors. We facilitate discovery, booking,
            payment, messaging, and — where the doctor chooses to offer it — video consultation
            hosting.
          </p>
          <p>
            <strong>We are not a healthcare provider.</strong> We do not employ the doctors listed
            on the platform, we do not direct or supervise their clinical work, and we do not
            provide medical advice, diagnosis, or treatment. The contract for any medical service
            is between <strong>you and the treating doctor</strong> (or the doctor&rsquo;s own clinical
            organisation). {COMPANY} is not a party to that clinical contract.
          </p>
          <p>
            For full detail of how {COMPANY} sits within the UK regulatory framework, how each
            listed doctor is regulated, and how to raise concerns, see our{" "}
            <a href="/regulatory" className="text-primary hover:underline">
              Regulatory Status page
            </a>
            .
          </p>

          <h2>3. Eligibility</h2>
          <ul>
            <li>You must be at least 16 years old to create an account.</li>
            <li>
              Doctors must hold valid GMC registration, a current licence to practise, appropriate
              indemnity insurance, and — where applicable — must have evidenced their CQC status
              (registered, exempt, or not applicable) to us at onboarding.
            </li>
            <li>You must provide accurate and complete information during registration.</li>
          </ul>

          <h2>4. User Accounts</h2>
          <ul>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must not share your account or allow others to access it.</li>
            <li>We recommend enabling multi-factor authentication for enhanced security.</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms.</li>
          </ul>

          <h2>5. Bookings &amp; Payments</h2>
          <h3>5.1 Booking Process</h3>
          <p>
            Bookings are confirmed only upon successful payment. Unpaid bookings expire
            automatically (15 minutes for patient-initiated, 48 hours for admin-created bookings).
            A confirmed booking is a contract between you and the doctor; {COMPANY} collects
            payment on the doctor&rsquo;s behalf as their agent for the limited purpose of payment
            processing.
          </p>

          <h3>5.2 Payments</h3>
          <p>
            All payments are processed securely via Stripe. Prices are displayed in the doctor&rsquo;s
            base currency with an indicative conversion where relevant. We do not store card
            details.
          </p>

          <h3>5.3 Cancellation &amp; Refunds</h3>
          <p>
            Each doctor sets their own cancellation policy (flexible, moderate, or strict).
            Refund eligibility depends on the policy and the time remaining before the appointment:
          </p>
          <ul>
            <li><strong>Flexible</strong> — Full refund if cancelled more than 24 hours before.</li>
            <li><strong>Moderate</strong> — Full refund if 48+ hours; 50% if 24-48 hours; no refund under 24 hours.</li>
            <li><strong>Strict</strong> — Full refund only if cancelled more than 72 hours before.</li>
          </ul>
          <p>
            Nothing in these Terms limits your statutory rights as a consumer under the Consumer
            Rights Act 2015.
          </p>

          <h2>6. Doctor Responsibilities &amp; Regulatory Warranties</h2>
          <p>Each doctor who lists on the platform warrants to us and to you that they:</p>
          <ul>
            <li>Hold current GMC registration and a licence to practise.</li>
            <li>
              Are either CQC-registered in their own right, or genuinely qualify for an exemption
              under the Health and Social Care Act 2008 (Regulated Activities) Regulations 2014
              (for example, the Medical Performers List exemption for named GPs, or the
              employed-by-a-registered-provider exemption).
            </li>
            <li>
              Do <strong>not</strong> provide any of the Schedule 2 paragraph 4 excluded procedures
              through the platform (including, but not limited to, anaesthesia, IV sedation,
              obstetric/childbirth services, termination of pregnancy, cosmetic surgery,
              haemodialysis, endoscopy involving instruments passed into a natural lumen,
              hyperbaric oxygen therapy, IV/intrathecal/epidural medicines, diagnostic imaging
              involving X-ray/MRI/CT, and radiotherapy).
            </li>
            <li>
              Carry appropriate indemnity insurance in force for the full duration of any
              consultation booked through the platform.
            </li>
            <li>
              Deliver consultations in accordance with GMC <em>Good Medical Practice</em> and the
              GMC guidance on remote prescribing.
            </li>
            <li>Maintain patient confidentiality in compliance with GMC and UK GDPR obligations.</li>
          </ul>
          <p>
            We verify GMC registration at onboarding and periodically re-verify. We also collect
            CQC / MPL / indemnity evidence at onboarding. However, the ultimate responsibility
            for regulatory compliance sits with the treating doctor.
          </p>

          <h2>7. Patient Responsibilities</h2>
          <ul>
            <li>Provide accurate information about your symptoms and medical history when requested by the doctor.</li>
            <li>
              Inform your NHS GP about any private consultation, prescription, or care plan you
              receive through the platform, so that your NHS record stays complete and safe.
            </li>
            <li>Attend booked appointments or cancel in accordance with the cancellation policy.</li>
            <li>
              Seek urgent care directly from <strong>999</strong>, <strong>111</strong>, or A&amp;E
              when appropriate. The platform is not designed for emergencies.
            </li>
          </ul>

          <h2>8. Medical Disclaimer &amp; Emergencies</h2>
          <p>
            {COMPANY} is a technology platform, not a medical practice. We do not:
          </p>
          <ul>
            <li>Provide medical advice, diagnoses, or treatment.</li>
            <li>Supervise, direct, or assume responsibility for a doctor&rsquo;s clinical decisions.</li>
            <li>Guarantee clinical outcomes from any consultation booked through the platform.</li>
          </ul>
          <p>
            <strong>
              In a medical emergency, call 999 or attend A&amp;E immediately. For urgent but
              non-emergency advice, call NHS 111.
            </strong>{" "}
            Do not rely on this platform for urgent care.
          </p>
          <p>
            If you believe a consultation booked through the platform has caused you harm, please
            see our <a href="/complaints" className="text-primary hover:underline">Complaints page</a>.
            You may raise a concern directly with the treating doctor, with the General Medical
            Council at <a href="https://www.gmc-uk.org" className="text-primary hover:underline">gmc-uk.org</a>,
            or — for concerns about the registered provider under which the doctor practises —
            with the Care Quality Commission at{" "}
            <a href="https://www.cqc.org.uk" className="text-primary hover:underline">cqc.org.uk</a>.
          </p>

          <h2>9. Regulatory Status</h2>
          <p>
            {COMPANY} is <strong>not</strong> registered with the Care Quality Commission as a
            provider of regulated activities, and does not need to be: it does not itself provide
            diagnosis, treatment, or advice. Every listed doctor is regulated in their own right —
            by the GMC, by their indemnity body, and (where applicable) by the CQC. Our{" "}
            <a href="/regulatory" className="text-primary hover:underline">
              Regulatory Status page
            </a>{" "}
            sets out exactly how to verify any doctor on the GMC register and the CQC provider
            directory.
          </p>

          <h2>10. Intellectual Property</h2>
          <p>
            All content, design, and functionality of the platform are owned by {LEGAL_ENTITY}.
            Users retain ownership of content they submit (reviews, intake information) but grant
            us a limited licence to display it as necessary for platform operation.
          </p>

          <h2>11. Prohibited Conduct</h2>
          <ul>
            <li>Impersonating another person or healthcare professional.</li>
            <li>Using the platform for illegal purposes.</li>
            <li>Attempting to circumvent security measures.</li>
            <li>Posting false reviews or misleading information.</li>
            <li>Harassing other users or staff.</li>
          </ul>

          <h2>12. Limitation of Liability</h2>
          <p>
            Nothing in these Terms excludes or limits our liability for death or personal injury
            caused by our negligence, for fraud or fraudulent misrepresentation, or for any other
            liability that cannot be excluded or limited under UK law.
          </p>
          <p>
            Subject to the paragraph above, to the maximum extent permitted by law, {LEGAL_ENTITY}:
          </p>
          <ul>
            <li>
              Is <strong>not</strong> liable for the clinical decisions, acts, or omissions of
              any doctor listed on the platform. Each doctor is an independent professional
              responsible for their own clinical work.
            </li>
            <li>
              Is not liable for loss of data beyond our reasonable control, or for service
              interruptions due to third-party providers.
            </li>
            <li>Is not liable for indirect, incidental, or consequential damages.</li>
          </ul>

          <h2>13. Privacy</h2>
          <p>
            Your use of {COMPANY} is also governed by our{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>, which
            describes how we collect, use, and protect your personal data under UK GDPR and the
            Data Protection Act 2018.
          </p>

          <h2>14. Governing Law &amp; Jurisdiction</h2>
          <p>
            These Terms are governed by the laws of England and Wales. Disputes will be subject to
            the exclusive jurisdiction of the English courts. If you are a consumer resident in
            Scotland or Northern Ireland, you may also bring proceedings in your local courts.
          </p>

          <h2>15. Changes to Terms</h2>
          <p>
            We may update these Terms periodically. Material changes will be notified via email.
            Continued use of the platform after notification constitutes acceptance of the updated
            Terms.
          </p>

          <h2>16. Contact</h2>
          <p>
            <strong>Legal entity:</strong> {LEGAL_ENTITY}
            <br />
            <strong>Companies House number:</strong> {COMPANIES_HOUSE_NUMBER}
            <br />
            <strong>Registered office:</strong> {REGISTERED_OFFICE}
            <br />
            <strong>General legal queries:</strong> legal@mydoctors360.com
            <br />
            <strong>Complaints:</strong> {COMPLAINTS_EMAIL} — see our{" "}
            <a href="/complaints" className="text-primary hover:underline">Complaints page</a> for
            the full process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
