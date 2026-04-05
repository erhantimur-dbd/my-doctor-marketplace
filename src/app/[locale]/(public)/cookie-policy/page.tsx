import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Cookie Policy | MyDoctors360",
  description: "Cookie policy for MyDoctors360 healthcare marketplace.",
};

const EFFECTIVE_DATE = "17 March 2026";
const COMPANY = "MyDoctors360";

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 py-12">
      <div>
        <h1 className="text-3xl font-bold">Cookie Policy</h1>
        <p className="mt-2 text-muted-foreground">
          Effective Date: {EFFECTIVE_DATE}
        </p>
      </div>

      <Card>
        <CardContent className="prose prose-sm max-w-none p-6 dark:prose-invert sm:p-8">
          <h2>1. What Are Cookies</h2>
          <p>
            Cookies are small text files that are placed on your device when you visit a website.
            They are widely used to make websites work more efficiently, provide a better user
            experience, and supply information to site owners. Some cookies are essential for the
            website to function, while others help us understand how visitors interact with our
            platform.
          </p>

          <h2>2. How We Use Cookies</h2>
          <p>
            {COMPANY} uses cookies to authenticate your sessions, remember your language and
            currency preferences, and (with your consent) analyse how our platform is used so
            we can improve it. We categorise our cookies into three types: strictly necessary,
            analytics, and marketing.
          </p>

          <h2>3. Types of Cookies We Use</h2>

          <h3>3.1 Strictly Necessary Cookies</h3>
          <p>
            These cookies are essential for the website to function and cannot be switched off
            in our systems. They are usually only set in response to actions you take, such as
            logging in or setting your privacy preferences.
          </p>
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

          <h3>3.2 Analytics Cookies (Requires Consent)</h3>
          <p>
            These cookies allow us to count visits and traffic sources so we can measure and
            improve the performance of our site. All information these cookies collect is
            aggregated and therefore anonymous.
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

          <h3>3.3 Marketing Cookies (Requires Consent)</h3>
          <p>
            Marketing cookies are used to track visitors across websites to allow publishers to
            display relevant and engaging advertisements. {COMPANY} does not currently use any
            marketing cookies. This category is reserved for future advertising campaigns and
            will be updated if marketing cookies are introduced.
          </p>

          <h2>4. How to Manage Cookies</h2>

          <h3>4.1 Via Our Cookie Consent Banner</h3>
          <p>
            When you first visit {COMPANY}, a cookie consent banner is displayed. You can accept
            or decline optional cookies (analytics and marketing) from this banner. Your preferences
            are saved and respected on all subsequent visits.
          </p>

          <h3>4.2 Via Browser Settings</h3>
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

          <h3>4.3 Via Account Settings</h3>
          <p>
            If you have a {COMPANY} account, you can manage your cookie preferences at any time
            by navigating to <strong>Dashboard &gt; Settings &gt; Manage Cookie Preferences</strong>.
          </p>

          <h2>5. Cookie Duration</h2>
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

          <h2>6. Third-Party Cookies</h2>
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

          <h2>7. Changes to This Policy</h2>
          <p>
            We may update this Cookie Policy from time to time to reflect changes in the cookies
            we use or for other operational, legal, or regulatory reasons. We encourage you to
            revisit this page periodically to stay informed about our use of cookies. The
            effective date at the top of this page indicates when this policy was last revised.
          </p>

          <h2>8. Contact</h2>
          <p>
            If you have any questions about our use of cookies or this policy, please contact us
            at <strong>privacy@mydoctors360.com</strong>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
