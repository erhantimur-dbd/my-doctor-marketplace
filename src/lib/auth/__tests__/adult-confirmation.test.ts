import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdultConfirmationCheckbox } from "@/components/auth/adult-confirmation-checkbox";
import {
  ADULT_CONFIRMATION_LABEL,
  ADULT_CONFIRMATION_REQUIRED_ERROR,
  PATIENT_TERMS_ELIGIBILITY,
  adultConfirmationError,
  canSubmitPatientSignup,
  isAdultConfirmed,
  isPatientAccountRole,
  patientSignupProfileStamp,
} from "@/lib/auth/adult-confirmation";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function sliceFunction(source: string, name: string): string {
  const start = source.indexOf(`async function ${name}`);
  const exported = source.indexOf(`export async function ${name}`);
  const at = exported >= 0 ? exported : start;
  expect(at, name).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nexport async function ", at + 1);
  const nextInternal = source.indexOf("\nasync function ", at + 1);
  const ends = [next, nextInternal].filter((index) => index > at);
  const end = ends.length > 0 ? Math.min(...ends) : source.length;
  return source.slice(at, end);
}

describe("adult confirmation rules", () => {
  it("accepts only an explicit confirmation", () => {
    expect(isAdultConfirmed("true")).toBe(true);
    expect(isAdultConfirmed("on")).toBe(true);
    expect(isAdultConfirmed(true)).toBe(true);
    expect(isAdultConfirmed("false")).toBe(false);
    expect(isAdultConfirmed(false)).toBe(false);
    expect(isAdultConfirmed(null)).toBe(false);
    expect(isAdultConfirmed(undefined)).toBe(false);
    expect(adultConfirmationError(null)).toBe(ADULT_CONFIRMATION_REQUIRED_ERROR);
    expect(adultConfirmationError("true")).toBeNull();
  });

  it("requires the checkbox before patient signup can be submitted", () => {
    const base = {
      acceptedTerms: true,
      passwordEnteredOk: true,
      loading: false,
    };
    expect(canSubmitPatientSignup({ ...base, adultConfirmed: false })).toBe(false);
    expect(canSubmitPatientSignup({ ...base, adultConfirmed: true })).toBe(true);
    expect(
      canSubmitPatientSignup({
        acceptedTerms: false,
        adultConfirmed: true,
        passwordEnteredOk: true,
      })
    ).toBe(false);
  });

  it("stamps adult_confirmed_at together with terms acceptance", () => {
    const now = new Date("2026-10-02T12:00:00.000Z");
    expect(patientSignupProfileStamp(now)).toEqual({
      terms_accepted_at: "2026-10-02T12:00:00.000Z",
      privacy_accepted_at: "2026-10-02T12:00:00.000Z",
      adult_confirmed_at: "2026-10-02T12:00:00.000Z",
    });
  });

  it("leaves doctor and admin accounts out of the patient confirmation", () => {
    expect(isPatientAccountRole("patient")).toBe(true);
    expect(isPatientAccountRole(null)).toBe(true);
    expect(isPatientAccountRole("doctor")).toBe(false);
    expect(isPatientAccountRole("admin")).toBe(false);
  });
});

describe("adult confirmation checkbox (component)", () => {
  it("renders the exact legal label on a required checkbox", () => {
    const html = renderToStaticMarkup(
      createElement(AdultConfirmationCheckbox, {
        id: "adult-confirmed",
        checked: false,
        onCheckedChange: () => undefined,
      })
    );
    expect(html.replace(/&#x27;|&#39;/g, "'")).toContain(ADULT_CONFIRMATION_LABEL);
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('name="adult_confirmed"');
    expect(html).toContain('value="false"');
    expect(ADULT_CONFIRMATION_LABEL).toBe("I confirm I'm 18 or over.");
  });

  it("gates every patient signup surface on that checkbox", () => {
    const authPage = read("src/components/auth/auth-page.tsx");
    const oauth = read("src/components/auth/oauth-buttons.tsx");
    const accept = read("src/app/[locale]/(auth)/accept-terms/accept-terms-form.tsx");
    const wizard = read("src/components/booking/booking-wizard.tsx");
    const doctorSignup = read("src/app/[locale]/(public)/register-doctor/page.tsx");

    expect(authPage).toContain("AdultConfirmationCheckbox");
    expect(authPage).toContain("canSubmitPatientSignup");
    expect(authPage).toContain('formData.set("adult_confirmed", "true")');
    expect(authPage).toContain("if (!adultConfirmed)");

    expect(oauth).toContain("patientSignup && !adultConfirmed");
    expect(oauth).toContain("patientSignup: true, adultConfirmed: true");

    expect(accept).toContain("AdultConfirmationCheckbox");
    expect(accept).toContain("requireAdultConfirmation && !adultConfirmed");

    expect(wizard).toContain("AdultConfirmationCheckbox");
    expect(wizard).toContain("guestAdultConfirmed");
    expect(wizard).toContain("adult_confirmed: guestAdultConfirmed");

    expect(doctorSignup).not.toContain(ADULT_CONFIRMATION_LABEL);
    expect(doctorSignup).not.toContain("adult_confirmed");
  });
});

describe("patient account creation paths", () => {
  const auth = read("src/actions/auth.ts");
  const register = sliceFunction(auth, "register");
  const doctor = sliceFunction(auth, "createDoctorAccount");
  const testing = sliceFunction(auth, "registerTestingService");
  const oauth = sliceFunction(auth, "signInWithOAuthProvider");
  const booking = read("src/actions/booking.ts");
  const guest = sliceFunction(booking, "resolvePatientForBooking");
  const accept = read("src/app/[locale]/(auth)/accept-terms/actions.ts");
  const claim = read("src/lib/auth/guest-claim.ts");

  it("rejects email signup before signUp and stamps adult_confirmed_at with the service role", () => {
    const checkAt = register.indexOf("isAdultConfirmed");
    const signUpAt = register.indexOf("supabase.auth.signUp");
    expect(checkAt).toBeGreaterThan(-1);
    expect(signUpAt).toBeGreaterThan(checkAt);
    expect(register).toContain("patientSignupProfileStamp()");
    expect(register).toContain("createAdminClient()");
    expect(register).not.toContain("supabase\n        .from(\"profiles\")");
  });

  it("rejects new patient OAuth without the confirmation and leaves doctor signup unchanged", () => {
    const checkAt = oauth.indexOf("options?.patientSignup && options.adultConfirmed !== true");
    const startAt = oauth.indexOf("supabase.auth.signInWithOAuth");
    expect(checkAt).toBeGreaterThan(-1);
    expect(startAt).toBeGreaterThan(checkAt);
    expect(doctor).not.toContain("adult_confirmed");
    expect(doctor).not.toContain("isAdultConfirmed");
    expect(testing).not.toContain("adult_confirmed");
    expect(testing).not.toContain("patientSignupProfileStamp");
  });

  it("rejects guest profile creation without the confirmation and records the stamp", () => {
    const checkAt = guest.indexOf("guest.adult_confirmed !== true");
    const createAt = guest.indexOf("auth.admin.createUser");
    expect(checkAt).toBeGreaterThan(-1);
    expect(createAt).toBeGreaterThan(checkAt);
    expect(guest).toContain("patientSignupProfileStamp()");
    expect(guest.indexOf("patientSignupProfileStamp()")).toBeGreaterThan(createAt);
  });

  it("stamps OAuth patients on accept-terms via the service role", () => {
    expect(accept).toContain("adultConfirmationError");
    expect(accept).toContain("createAdminClient()");
    expect(accept).toContain("patientSignupProfileStamp");
    expect(accept.indexOf("adultConfirmationError")).toBeLessThan(
      accept.indexOf("createAdminClient()")
    );
  });

  it("does not create a profile from the guest magic-link claim", () => {
    expect(claim).not.toContain("createUser");
    expect(claim).not.toContain("adult_confirmed_at");
    expect(claim).toContain('selectGuestClaimLinkType("magiclink")');
  });
});

describe("terms and privacy copy", () => {
  const termsDefault = read("src/app/[locale]/(public)/terms/terms-default.tsx");
  const termsUk = read("src/app/[locale]/(public)/terms/terms-uk.tsx");
  const privacyDefault = read("src/app/[locale]/(public)/privacy/privacy-default.tsx");
  const privacyUk = read("src/app/[locale]/(public)/privacy/privacy-uk.tsx");

  it("uses the exact eligibility sentence and keeps each doctor sentence", () => {
    expect(PATIENT_TERMS_ELIGIBILITY).toBe(
      "You must be 18 or over to create a patient account. A parent or guardian can book for a child under 18 by adding them as a dependent on their own account."
    );
    for (const source of [termsDefault, termsUk]) {
      expect(source).toContain(PATIENT_TERMS_ELIGIBILITY);
      expect(source).not.toContain("at least 16 years old");
    }
    expect(termsDefault).toContain(
      "Doctors must hold a valid GMC registration (or equivalent) to list on our platform."
    );
    expect(termsUk).toContain(
      "Doctors must hold valid GMC registration, a current licence to practise, appropriate"
    );
    expect(termsUk).toContain(
      "indemnity insurance, and — where applicable — must have evidenced their CQC status"
    );
  });

  it("uses the approved children sentence and leaves retention numbers alone", () => {
    const children =
      "Children under 18 can't hold an account. A parent or guardian can add a child as a dependent on their own account. We use the child's details only to book and manage their appointments, and the parent or guardian is responsible for them.";
    expect(privacyDefault).toContain(children);
    expect(privacyUk).toContain(children);
    expect(privacyDefault).not.toContain("not directed to individuals under");
    expect(privacyUk).not.toContain("not directed to individuals under");
    expect(privacyDefault).not.toContain("under 16");
    expect(privacyUk).not.toContain("under 16");
    expect(privacyUk).toContain("If you believe a child has registered, please contact");
    expect(privacyDefault).not.toContain("PRIVACY_PUBLISH_DATE");
    expect(privacyUk).not.toContain("PRIVACY_PUBLISH_DATE");

    expect(privacyDefault).toContain(
      "Retained for 8 years (UK medical records retention requirement)."
    );
    expect(privacyDefault).toContain("Retained for 7 years (tax obligations).");
    expect(privacyDefault).toContain(
      "Automatically deleted after 15 minutes (patient) or 48 hours (admin-created)"
    );
    expect(privacyUk).toContain("Retained for 7 years (HMRC tax obligation).");
    expect(privacyUk).toContain(
      "Retained for 2 years for security and fraud-prevention"
    );
    expect(privacyUk).toContain("<h2>16. Contact &amp; Complaints</h2>");
  });
});

describe("00146 profile adult_confirmed_at lock", () => {
  const sql = read("supabase/migrations/00146_profile_adult_confirmed_at.sql");

  it("adds the nullable column and locks it to service_role", () => {
    expect(sql).toContain(
      "ADD COLUMN IF NOT EXISTS adult_confirmed_at TIMESTAMPTZ"
    );
    expect(sql).not.toMatch(/adult_confirmed_at TIMESTAMPTZ NOT NULL/);
    expect(sql).toContain("SECURITY DEFINER");
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.prevent_profile_privileged_column_update() FROM PUBLIC"
    );
    expect(sql).toContain(
      "REVOKE EXECUTE ON FUNCTION public.prevent_profile_privileged_column_update() FROM anon, authenticated, PUBLIC"
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.prevent_profile_privileged_column_update() TO service_role"
    );
    expect(sql).not.toMatch(
      /GRANT EXECUTE ON FUNCTION public\.prevent_profile_privileged_column_update\(\) TO anon/
    );
    expect(sql).toContain("BEFORE INSERT OR UPDATE ON public.profiles");
    expect(sql).toContain(
      "Cannot modify privileged profile columns (adult_confirmed_at)"
    );
    expect(sql).toContain(
      "REVOKE UPDATE (adult_confirmed_at) ON TABLE public.profiles FROM PUBLIC, anon, authenticated"
    );
    expect(sql).toContain("(SELECT auth.role()) = 'service_role'");
  });
});
