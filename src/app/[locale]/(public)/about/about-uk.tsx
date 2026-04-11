import { Card, CardContent } from "@/components/ui/card";

/**
 * UK About page — served on `mydoctors360.co.uk` only.
 *
 * Reinforces the intermediary positioning that terms-uk, privacy-uk,
 * regulatory-uk and complaints-uk set out. Must not contain any claim that
 * {COMPANY} provides, endorses, or curates clinical care. Must not contain
 * vague marketing language like "trusted", "vetted", "best" without a
 * verifiable claim behind it.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name
 *   - Companies House number
 */

const COMPANY = "MyDoctors360";
const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPANIES_HOUSE_NUMBER = "TBD_COMPANIES_HOUSE_NUMBER";

export function AboutUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">About {COMPANY}</h1>
        <p className="mt-2 text-muted-foreground">
          A booking platform for private doctors in the United Kingdom.
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>What we do</h2>
          <p>
            {COMPANY} helps patients in the UK find and book appointments with independent
            private doctors. You can search by specialty, location, language, or symptom, view
            a doctor&rsquo;s GMC number, check their fees upfront, and pay securely when you
            book.
          </p>

          <h2>What we are — and what we&rsquo;re not</h2>
          <p>
            {COMPANY} is a <strong>technology platform</strong>. We run the website, take
            bookings, collect payments on behalf of doctors, and carry messages and documents
            between patients and doctors.
          </p>
          <p>
            We are <strong>not</strong> a healthcare provider. We don&rsquo;t employ doctors,
            don&rsquo;t supervise their clinical decisions, don&rsquo;t issue prescriptions, and
            don&rsquo;t provide medical advice. The contract for medical care is between you
            and the treating doctor. Every doctor on the platform is regulated in their own
            right by the GMC and, where applicable, by the Care Quality Commission.
          </p>
          <p>
            Our{" "}
            <a href="/regulatory" className="text-primary hover:underline">
              Regulatory Status page
            </a>{" "}
            sets out exactly how this works, how to verify any doctor on the GMC register, and
            what happens if something goes wrong.
          </p>

          <h2>How we verify doctors</h2>
          <ul>
            <li>
              We check each doctor&rsquo;s GMC registration against the public GMC register
              before they go live on the platform, and re-check it on a regular cycle.
            </li>
            <li>
              We ask every UK-practising doctor to evidence their CQC position —
              registered in their own right, exempt, or not applicable — at onboarding.
            </li>
            <li>
              We ask every doctor to evidence current professional indemnity insurance.
            </li>
            <li>
              We do not list any doctor who provides CQC Schedule 2 paragraph 4 excluded
              procedures through the platform. See the{" "}
              <a href="/regulatory" className="text-primary hover:underline">
                Regulatory Status page
              </a>{" "}
              for the full list.
            </li>
          </ul>

          <h2>Emergencies</h2>
          <p>
            {COMPANY} is not an emergency service. If you think you&rsquo;re having an
            emergency, please <strong>call 999</strong> or attend A&amp;E. For urgent but
            non-emergency advice, call <strong>NHS 111</strong>.
          </p>

          <h2>Company information</h2>
          <ul>
            <li>
              <strong>Legal entity:</strong> {LEGAL_ENTITY}
            </li>
            <li>
              <strong>Companies House number:</strong> {COMPANIES_HOUSE_NUMBER}
            </li>
            <li>
              <strong>Registered with the ICO:</strong> see our{" "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>.
            </li>
          </ul>

          <h2>Contact</h2>
          <p>
            General queries: <strong>hello@mydoctors360.com</strong>
            <br />
            Support: <strong>support@mydoctors360.com</strong>
            <br />
            Complaints: see our{" "}
            <a href="/complaints" className="text-primary hover:underline">Complaints page</a>.
            <br />
            Privacy: <strong>privacy@mydoctors360.com</strong>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
