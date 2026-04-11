import { Card, CardContent } from "@/components/ui/card";

/**
 * UK Cookie Policy — served on `mydoctors360.co.uk` only.
 *
 * Adds ICO / PECR wording, the UK legal entity, and the ICO complaint
 * pathway. The cookie inventory and consent behaviour are the same as the
 * default variant; the legal framing is the UK-specific bit.
 *
 * TBD placeholders (must be supplied by the user before go-live):
 *   - Legal entity name
 *   - Companies House number
 *   - ICO data controller registration number
 *   - DPO name + contact
 */

const EFFECTIVE_DATE = "17 March 2026";
const COMPANY = "MyDoctors360";

const LEGAL_ENTITY = "TBD_LEGAL_ENTITY_NAME";
const COMPANIES_HOUSE_NUMBER = "TBD_COMPANIES_HOUSE_NUMBER";
const ICO_REGISTRATION_NUMBER = "TBD_ICO_REGISTRATION_NUMBER";
const DPO_EMAIL = "TBD_DPO_EMAIL";

export function CookiePolicyUk() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Cookie Policy (United Kingdom)</h1>
        <p className="mt-2 text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>1. Who We Are</h2>
          <p>
            {COMPANY} is operated in the United Kingdom by {LEGAL_ENTITY} (company number{" "}
            {COMPANIES_HOUSE_NUMBER}). We are registered with the Information Commissioner&rsquo;s
            Office (registration number {ICO_REGISTRATION_NUMBER}). This Cookie Policy explains
            how we use cookies and similar technologies on this website in compliance with the
            Privacy and Electronic Communications Regulations 2003 (PECR) and the UK GDPR.
          </p>

          <h2>2. What Are Cookies</h2>
          <p>
            Cookies are small text files that are placed on your device when you visit a website.
            They are widely used to make websites work more efficiently, provide a better user
            experience, and supply information to site owners. Some cookies are strictly necessary
            for the website to function; others require your consent before they are set.
          </p>

          <h2>3. Our Legal Basis for Cookies</h2>
          <p>Under PECR and UK GDPR we treat cookies in two groups:</p>
          <ul>
            <li>
              <strong>Strictly necessary cookies</strong> — set without consent because the
              service you requested cannot work without them (e.g. staying logged in). These rely
              on the &ldquo;strictly necessary&rdquo; exemption in PECR Regulation 6(4).
            </li>
            <li>
              <strong>Non-essential cookies</strong> (analytics, marketing) — set{" "}
              <em>only</em> after you give explicit, opt-in consent via our cookie consent banner.
              We do not assume consent and you can withdraw it at any time from Dashboard &gt;
              Settings &gt; Manage Cookie Preferences.
            </li>
          </ul>

          <h2>4. Types of Cookies We Use</h2>

          <h3>4.1 Strictly Necessary Cookies</h3>
          <table>
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>sb-*-auth-token</code></td>
                <td>Supabase authentication session — keeps you logged in securely.</td>
              </tr>
              <tr>
                <td><code>NEXT_LOCALE</code></td>
                <td>Stores your language preference so the site loads in the correct language.</td>
              </tr>
              <tr>
                <td><code>cookie_consent</code></td>
                <td>Stores your cookie preferences (localStorage) so we respect your choices on subsequent visits.</td>
              </tr>
            </tbody>
          </table>

          <h3>4.2 Analytics Cookies (Require Consent)</h3>
          <p>
            These cookies allow us to count visits and traffic sources so we can measure and
            improve the performance of our site. All information these cookies collect is
            aggregated and IP-anonymised.
          </p>
          <table>
            <thead>
              <tr>
                <th>Cookie</th>
                <th>Provider</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>_ga</code></td>
                <td>Google Analytics (GA4)</td>
                <td>Distinguishes unique users by assigning a randomly generated number as a client identifier.</td>
              </tr>
              <tr>
                <td><code>_ga_*</code></td>
                <td>Google Analytics (GA4)</td>
                <td>Used to persist session state and track site usage patterns.</td>
              </tr>
            </tbody>
          </table>
          <p>
            IP anonymisation is enabled for all Google Analytics data collection, meaning your
            full IP address is never stored by Google.
          </p>

          <h3>4.3 Marketing Cookies (Require Consent)</h3>
          <p>
            Marketing cookies are used to track visitors across websites to allow publishers to
            display relevant and engaging advertisements. {COMPANY} does not currently use any
            marketing cookies. This category is reserved for future advertising campaigns and
            will be updated — and fresh consent sought — if marketing cookies are introduced.
          </p>

          <h2>5. How to Manage or Withdraw Consent</h2>
          <h3>5.1 Via Our Cookie Consent Banner</h3>
          <p>
            When you first visit {COMPANY}, a cookie consent banner is displayed. You can accept
            or decline optional cookies from this banner. You can change your choice at any time
            from the same banner or from Dashboard &gt; Settings &gt; Manage Cookie Preferences.
          </p>

          <h3>5.2 Via Browser Settings</h3>
          <p>
            Most browsers allow you to control cookies through their settings. You can typically
            find these options under &ldquo;Privacy&rdquo; or &ldquo;Security&rdquo; in your
            browser preferences. For specific instructions, visit:
          </p>
          <ul>
            <li>
              <strong>Google Chrome:</strong>{" "}
              <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer">
                support.google.com/chrome/answer/95647
              </a>
            </li>
            <li>
              <strong>Mozilla Firefox:</strong>{" "}
              <a href="https://support.mozilla.org/en-US/kb/clear-cookies-and-site-data-firefox" target="_blank" rel="noopener noreferrer">
                support.mozilla.org/kb/clear-cookies-and-site-data-firefox
              </a>
            </li>
            <li>
              <strong>Safari:</strong>{" "}
              <a href="https://support.apple.com/en-gb/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer">
                support.apple.com/en-gb/guide/safari/sfri11471
              </a>
            </li>
            <li>
              <strong>Microsoft Edge:</strong>{" "}
              <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer">
                support.microsoft.com/en-us/microsoft-edge/delete-cookies
              </a>
            </li>
          </ul>
          <p>
            Please note that disabling strictly necessary cookies may prevent you from using
            certain features of our platform, such as logging in or completing bookings.
          </p>

          <h2>6. Cookie Duration</h2>
          <p>
            Cookies can be either <strong>session cookies</strong> or <strong>persistent cookies</strong>:
          </p>
          <ul>
            <li>
              <strong>Session cookies</strong> are temporary and are deleted when you close your
              browser.
            </li>
            <li>
              <strong>Persistent cookies</strong> remain on your device for a set period or until
              you manually delete them.
            </li>
          </ul>
          <p>Our specific cookie durations:</p>
          <ul>
            <li>
              <strong>Authentication cookies</strong> (<code>sb-*-auth-token</code>) — persist
              until you log out or for up to 1 year.
            </li>
            <li>
              <strong>Language preference</strong> (<code>NEXT_LOCALE</code>) — persistent, up
              to 1 year.
            </li>
            <li>
              <strong>Cookie consent</strong> — persistent, stored in localStorage indefinitely
              until cleared.
            </li>
            <li>
              <strong>Analytics cookies</strong> (<code>_ga</code>, <code>_ga_*</code>) — up to
              2 years (Google Analytics default retention).
            </li>
          </ul>

          <h2>7. Third-Party Cookies</h2>
          <p>
            Some cookies on our site are set by third-party services that appear on our pages.
            We do not control the dissemination of these cookies. The third parties that may set
            cookies through our platform include:
          </p>
          <ul>
            <li>
              <strong>Google Analytics</strong> (analytics.google.com) — analytics cookies to help
              us understand site usage. Subject to your consent.
            </li>
            <li>
              <strong>Stripe</strong> (stripe.com) — strictly necessary cookies for secure payment
              processing. These cookies are required for the payment system to function and cannot
              be disabled.
            </li>
          </ul>
          <p>
            For information on how these third parties use cookies, please refer to their
            respective privacy and cookie policies.
          </p>

          <h2>8. Changes to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in the cookies
            we use or for other operational, legal, or regulatory reasons. We will seek fresh
            consent where required by PECR and UK GDPR — for example, where we introduce a new
            category of non-essential cookies.
          </p>

          <h2>9. Contact &amp; Complaints</h2>
          <p>
            For cookie and privacy queries: <strong>{DPO_EMAIL}</strong> or{" "}
            <strong>privacy@mydoctors360.com</strong>. See our{" "}
            <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a> for
            full data-protection detail.
          </p>
          <p>
            If you are unhappy with how we have handled your personal data, you have the right
            to complain to the Information Commissioner&rsquo;s Office:{" "}
            <a href="https://ico.org.uk" className="text-primary hover:underline">ico.org.uk</a>{" "}
            — 0303 123 1113 — Wycliffe House, Water Lane, Wilmslow, Cheshire, SK9 5AF.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
