export type SignupRole = "patient" | "doctor";

/** Signup metadata may request patient or doctor — never admin. */
export function roleFromSignupMetadata(
  raw: string | null | undefined
): SignupRole {
  return raw === "doctor" ? "doctor" : "patient";
}
