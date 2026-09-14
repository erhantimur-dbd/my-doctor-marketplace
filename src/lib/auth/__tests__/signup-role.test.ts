import { describe, expect, it } from "vitest";
import { roleFromSignupMetadata } from "@/lib/auth/signup-role";

describe("roleFromSignupMetadata", () => {
  it("never promotes signup metadata to admin", () => {
    expect(roleFromSignupMetadata("admin")).toBe("patient");
    expect(roleFromSignupMetadata("ADMIN")).toBe("patient");
    expect(roleFromSignupMetadata("superuser")).toBe("patient");
  });

  it("allows patient and doctor only", () => {
    expect(roleFromSignupMetadata("patient")).toBe("patient");
    expect(roleFromSignupMetadata("doctor")).toBe("doctor");
    expect(roleFromSignupMetadata(null)).toBe("patient");
    expect(roleFromSignupMetadata(undefined)).toBe("patient");
  });
});
