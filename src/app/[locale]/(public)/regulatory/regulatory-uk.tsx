import { Card, CardContent } from "@/components/ui/card";

/**
 * UK Regulatory Status page — served on `mydoctors360.co.uk` only.
 *
 * This page sets out, in plain English, why {COMPANY} itself is not
 * CQC-registered, how each listed doctor is regulated in their own right,
 * and how patients can verify any doctor on the GMC register and the CQC
 * provider directory. It is the page terms-uk.tsx and complaints-uk.tsx
 * both link to.
 *
 * Must be signed off by a UK healthcare regulatory solicitor before
 * publication. Do NOT publish with any "TBD_" placeholder still in place.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name
 *   - Companies House number
 *   - Indemnity insurance details for {LEGAL_ENTITY} itself (E&O / cyber)
 */

const COMPANY = "MyDoctors360";
const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPANIES_HOUSE_NUMBER = "TBD_COMPANIES_HOUSE_NUMBER";
const INDEMNITY_SUMMARY = "TBD_INDEMNITY_INSURER_AND_COVER_SUMMARY";

export function RegulatoryUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Regulatory Status</h1>
        <p className="mt-2 text-muted-foreground">
          How {COMPANY} is regulated in the United Kingdom.
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>In short</h2>
          <p>
            {COMPANY} is a <strong>technology platform</strong>. We help you find and book
            appointments with independent private doctors. We are <strong>not</strong> a
            healthcare provider, and we do not provide medical advice, diagnosis, or treatment.
            Every doctor you find on the platform is regulated in their own right by the General
            Medical Council (GMC) and, where applicable, by the Care Quality Commission (CQC).
          </p>

          <h2>Who we are</h2>
          <ul>
            <li>
              <strong>Legal entity:</strong> {LEGAL_ENTITY}
            </li>
            <li>
              <strong>Companies House number:</strong> {COMPANIES_HOUSE_NUMBER}
            </li>
            <li>
              <strong>What we do:</strong> operate a booking and payments platform for private
              medical consultations. We run the website, collect payments on behalf of doctors,
              transmit messages and documents between patients and doctors, and provide video
              rooms where the doctor chooses to consult online.
            </li>
            <li>
              <strong>What we don&rsquo;t do:</strong> employ doctors, supervise their clinical
              decisions, write prescriptions, diagnose conditions, hold ourselves out as a GP
              practice or clinic, or run a regulated activity under the Health and Social Care
              Act 2008.
            </li>
            <li>
              <strong>Our own insurance:</strong> {INDEMNITY_SUMMARY}. This is separate from the
              clinical indemnity each doctor carries.
            </li>
          </ul>

          <h2>Why {COMPANY} is not CQC-registered</h2>
          <p>
            The Care Quality Commission (CQC) is the independent regulator of health and adult
            social care in England. Under the Health and Social Care Act 2008, an organisation
            must register with the CQC if it &ldquo;carries on a regulated activity&rdquo; such
            as Treatment of Disease, Disorder or Injury or Diagnostic and Screening Procedures.
          </p>
          <p>
            {COMPANY} does not carry on a regulated activity. We don&rsquo;t decide who gets
            treated, we don&rsquo;t decide how they get treated, we don&rsquo;t issue
            prescriptions, and we don&rsquo;t supervise anybody&rsquo;s clinical work. Every
            clinical decision is made by the individual doctor under their own GMC registration
            and — where it applies — under their own CQC registration. Patients contract for
            medical services directly with the doctor; our contract with each party is for
            technology, payment collection, and communications only.
          </p>
          <p>
            This is the same position taken by other well-known UK booking and directory
            platforms that connect patients with private doctors. If the shape of our service
            ever changes — for example, if we were to start employing doctors or directing
            clinical pathways — our position would change, and we would apply to register with
            the CQC before any such change went live.
          </p>

          <h2>How each doctor is regulated</h2>
          <p>Every doctor listed on {COMPANY} is regulated in three ways:</p>
          <ol>
            <li>
              <strong>By the General Medical Council (GMC).</strong> Every UK-practising doctor
              must be on the GMC register and must hold a current licence to practise. We verify
              a doctor&rsquo;s GMC number at onboarding and on each re-verification cycle.
            </li>
            <li>
              <strong>By the Care Quality Commission (CQC), where applicable.</strong> If a
              doctor provides a regulated activity in their own right, they or the provider they
              work for must be registered with the CQC. Some doctors do not need CQC
              registration personally because they fall within a legitimate exemption (for
              example, GPs on a Medical Performers List who do not provide any of the Schedule 2
              paragraph 4 &ldquo;excluded&rdquo; procedures, or doctors employed by a
              CQC-registered provider). We collect evidence of each doctor&rsquo;s CQC status —
              registered, exempt, or not applicable — at onboarding.
            </li>
            <li>
              <strong>By their indemnity body.</strong> Every doctor who lists on {COMPANY} must
              hold appropriate professional indemnity insurance for the consultations they
              deliver through the platform.
            </li>
          </ol>

          <h2>How to verify a doctor</h2>
          <p>
            You are welcome — and encouraged — to verify any doctor on the platform directly
            against the official public registers.
          </p>
          <ul>
            <li>
              <strong>GMC Register:</strong>{" "}
              <a
                href="https://www.gmc-uk.org/registration-and-licensing/the-medical-register"
                className="text-primary hover:underline"
              >
                gmc-uk.org/registration-and-licensing/the-medical-register
              </a>{" "}
              — search by name or GMC number.
            </li>
            <li>
              <strong>CQC provider search:</strong>{" "}
              <a
                href="https://www.cqc.org.uk/search/services"
                className="text-primary hover:underline"
              >
                cqc.org.uk/search/services
              </a>{" "}
              — search for the doctor&rsquo;s registered clinic or provider organisation.
            </li>
            <li>
              <strong>Medical Performers List (NHS England):</strong>{" "}
              <a
                href="https://www.england.nhs.uk/primary-care/medical/"
                className="text-primary hover:underline"
              >
                england.nhs.uk/primary-care/medical
              </a>{" "}
              — for GP performers.
            </li>
          </ul>
          <p>
            Each doctor&rsquo;s profile page on {COMPANY} displays their GMC number so you can
            cross-check it against the public register in seconds.
          </p>

          <h2>What we do not offer</h2>
          <p>
            To keep our position as a technology intermediary clear and safe, we do not facilitate
            any of the CQC Schedule 2 paragraph 4 &ldquo;excluded procedures&rdquo; on the
            platform. These are higher-risk procedures where CQC registration of the individual
            doctor is always required. They include:
          </p>
          <ul>
            <li>Anaesthesia and intravenous sedation.</li>
            <li>Obstetric and midwifery services, and care associated with childbirth.</li>
            <li>Termination of pregnancy.</li>
            <li>Cosmetic surgery that enters the body deeper than the skin surface.</li>
            <li>Haemodialysis.</li>
            <li>Endoscopy involving instruments passed into a natural lumen of the body.</li>
            <li>Hyperbaric oxygen therapy.</li>
            <li>IV, intrathecal, or epidural prescription medicines.</li>
            <li>Diagnostic imaging using X-ray, MRI, or CT.</li>
            <li>Radiotherapy.</li>
          </ul>
          <p>
            Doctors agree to this restriction as part of their listing contract with {COMPANY}.
            If you see a doctor on the platform advertising one of these services, please let us
            know at{" "}
            <a href="/complaints" className="text-primary hover:underline">/complaints</a> so we
            can investigate.
          </p>

          <h2>Emergencies</h2>
          <p>
            {COMPANY} is not an emergency service and is not designed to triage urgent care. If
            you think you are having an emergency, please <strong>call 999</strong> or attend
            A&amp;E. For urgent but non-emergency advice, call <strong>NHS 111</strong>.
          </p>

          <h2>Complaints and concerns</h2>
          <p>
            Concerns about <strong>the platform itself</strong> (bookings, payments, messaging,
            website issues) should come to us first. Concerns about <strong>a doctor&rsquo;s
            clinical care</strong> should go to the doctor, to the registered provider under
            which they practise, to the GMC, and where applicable to the CQC. Our{" "}
            <a href="/complaints" className="text-primary hover:underline">Complaints page</a>{" "}
            explains the full process.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
