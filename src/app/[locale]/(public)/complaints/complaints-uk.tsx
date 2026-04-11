import { Card, CardContent } from "@/components/ui/card";

/**
 * UK Complaints page — served on `mydoctors360.co.uk` only.
 *
 * Separates complaints into two clear tracks: platform complaints (come to
 * us first) and clinical complaints (go to the doctor / registered provider
 * / GMC / CQC). Data-protection complaints point to the ICO. The platform
 * complaints track must commit to a response time and be owned by a named
 * person, which the user will supply later.
 *
 * Must be signed off by a UK healthcare regulatory solicitor before
 * publication. Do NOT publish with any "TBD_" placeholder still in place.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name
 *   - Named complaints handler (or team alias)
 *   - Complaints handler email
 */

const COMPANY = "MyDoctors360";
const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPLAINTS_HANDLER = "TBD_COMPLAINTS_HANDLER_NAME_OR_TEAM";
const COMPLAINTS_EMAIL = "TBD_COMPLAINTS_EMAIL";

export function ComplaintsUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Complaints</h1>
        <p className="mt-2 text-muted-foreground">
          How to raise a concern about {COMPANY} or about the care you received.
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>In an emergency</h2>
          <p>
            If you are worried about your immediate health, please{" "}
            <strong>call 999</strong> or attend A&amp;E. For urgent but non-emergency advice,
            call <strong>NHS 111</strong>. This complaints process is not a substitute for
            urgent clinical care.
          </p>

          <h2>Where does your complaint go?</h2>
          <p>
            {COMPANY} is a technology platform. We operate the website, take bookings, process
            payments, and carry messages and documents between patients and doctors. We do not
            provide medical care. That means there are two different tracks for complaints:
          </p>
          <ol>
            <li>
              <strong>Complaints about the platform itself</strong> — bookings, payments,
              refunds, website errors, account issues, data-protection questions, something a
              member of our staff said or did. These come to us.
            </li>
            <li>
              <strong>Complaints about the clinical care you received</strong> — a doctor&rsquo;s
              diagnosis, treatment, communication, professional conduct, or the way a
              prescription or care plan was handled. These go to the doctor and to the
              professional regulators.
            </li>
          </ol>
          <p>
            If you&rsquo;re not sure which track applies, start with us at{" "}
            <a href={`mailto:${COMPLAINTS_EMAIL}`} className="text-primary hover:underline">
              {COMPLAINTS_EMAIL}
            </a>{" "}
            — we will point you to the right place.
          </p>

          <h2>Track 1: Complaints about the platform</h2>
          <p>
            To complain about {COMPANY}, please contact {COMPLAINTS_HANDLER} at{" "}
            <a href={`mailto:${COMPLAINTS_EMAIL}`} className="text-primary hover:underline">
              {COMPLAINTS_EMAIL}
            </a>
            . Please include:
          </p>
          <ul>
            <li>Your name and the email address on your account.</li>
            <li>The booking reference, if applicable.</li>
            <li>A description of what went wrong and when.</li>
            <li>What you&rsquo;d like us to do to put it right.</li>
          </ul>
          <p>
            We will acknowledge your complaint within <strong>3 working days</strong> and aim to
            give you a substantive response within <strong>20 working days</strong>. If the
            matter is complex and needs more time, we will tell you so in writing and explain
            why.
          </p>
          <p>
            If you&rsquo;re unhappy with our final response, you can escalate to an independent
            body depending on the subject matter:
          </p>
          <ul>
            <li>
              <strong>Payment disputes:</strong> your card issuer under Section 75 of the
              Consumer Credit Act 1974 (credit card) or under the chargeback scheme (debit
              card).
            </li>
            <li>
              <strong>Consumer rights more generally:</strong> Citizens Advice —{" "}
              <a
                href="https://www.citizensadvice.org.uk"
                className="text-primary hover:underline"
              >
                citizensadvice.org.uk
              </a>{" "}
              — or the relevant Trading Standards office.
            </li>
            <li>
              <strong>Data protection concerns:</strong> the Information Commissioner&rsquo;s
              Office — see track 3 below.
            </li>
          </ul>

          <h2>Track 2: Complaints about clinical care</h2>
          <p>
            If your concern is about the clinical care you received from a doctor you booked
            through {COMPANY}, please escalate in this order:
          </p>
          <ol>
            <li>
              <strong>Raise it with the doctor directly.</strong> Most concerns can be resolved
              quickly if the doctor has the opportunity to review what happened. You can message
              them through the platform or contact them at the address shown on their profile.
            </li>
            <li>
              <strong>Raise it with the doctor&rsquo;s registered provider.</strong> Every
              CQC-registered private clinic has a published complaints procedure. The doctor can
              tell you which provider they practise under. You can also look them up on the CQC
              provider directory at{" "}
              <a
                href="https://www.cqc.org.uk/search/services"
                className="text-primary hover:underline"
              >
                cqc.org.uk/search/services
              </a>
              .
            </li>
            <li>
              <strong>Raise it with the General Medical Council (GMC).</strong> The GMC
              investigates concerns about a doctor&rsquo;s fitness to practise. Their complaints
              service is at{" "}
              <a
                href="https://www.gmc-uk.org/concerns"
                className="text-primary hover:underline"
              >
                gmc-uk.org/concerns
              </a>
              . You can also call them on 0161 923 6602.
            </li>
            <li>
              <strong>Raise it with the Care Quality Commission (CQC).</strong> The CQC
              regulates healthcare providers (not individual doctors). If your complaint is
              about the way a registered provider ran a service, you can contact the CQC at{" "}
              <a
                href="https://www.cqc.org.uk/contact-us/how-complain"
                className="text-primary hover:underline"
              >
                cqc.org.uk/contact-us/how-complain
              </a>
              {" "}or on 03000 616161.
            </li>
            <li>
              <strong>Independent Sector Complaints Adjudication Service (ISCAS).</strong> Many
              private healthcare providers subscribe to ISCAS for independent review of
              unresolved complaints:{" "}
              <a
                href="https://iscas.cedr.com"
                className="text-primary hover:underline"
              >
                iscas.cedr.com
              </a>
              .
            </li>
          </ol>
          <p>
            {COMPANY} cannot investigate a doctor&rsquo;s clinical decision-making in the same
            way the GMC and CQC can. What we can do is remove a doctor from the platform if a
            regulator finds against them, and that is something we take very seriously — please
            tell us about any regulatory action at{" "}
            <a href={`mailto:${COMPLAINTS_EMAIL}`} className="text-primary hover:underline">
              {COMPLAINTS_EMAIL}
            </a>{" "}
            so we can update our records.
          </p>

          <h2>Track 3: Data protection complaints</h2>
          <p>
            If your complaint is about how {LEGAL_ENTITY} has handled your personal data, please
            see our{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for
            the full process. In short:
          </p>
          <ul>
            <li>
              Contact our Data Protection Lead first at the address listed in the Privacy
              Policy. We&rsquo;d like the chance to put things right.
            </li>
            <li>
              If you remain unhappy, you have the right to complain to the Information
              Commissioner&rsquo;s Office at{" "}
              <a href="https://ico.org.uk" className="text-primary hover:underline">
                ico.org.uk
              </a>{" "}
              or on 0303 123 1113.
            </li>
          </ul>

          <h2>Safeguarding concerns</h2>
          <p>
            If you are worried about the immediate safety of a child or an adult at risk, please
            contact the relevant local authority safeguarding team, or call 999 in an emergency.
            You can also let us know at{" "}
            <a href={`mailto:${COMPLAINTS_EMAIL}`} className="text-primary hover:underline">
              {COMPLAINTS_EMAIL}
            </a>
            .
          </p>

          <h2>Duty of candour</h2>
          <p>
            Where something has gone wrong that we should have prevented or better mitigated, we
            will tell you what happened, apologise, explain what we&rsquo;re doing about it, and
            — where appropriate — escalate it to the relevant regulator ourselves.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
