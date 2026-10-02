import { beforeEach, describe, expect, it, vi } from "vitest";
import { ADULT_CONFIRMATION_REQUIRED_ERROR } from "@/lib/auth/adult-confirmation";

const signUp = vi.fn();
const getUser = vi.fn();
const userFrom = vi.fn();
const adminFrom = vi.fn();
const adminUpdate = vi.fn();
const adminEq = vi.fn();

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ limited: false, remaining: 1 })),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => ({
    get: () => null,
  })),
  cookies: vi.fn(async () => ({
    set: vi.fn(),
    get: vi.fn(),
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const error = new Error(`REDIRECT:${url}`);
    throw error;
  }),
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(async () => ({ id: "email" })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { signUp, getUser },
    from: userFrom,
  })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: adminFrom,
  })),
}));

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const patientFields = {
  email: "ada@example.com",
  password: "Abcdef1!",
  first_name: "Ada",
  last_name: "Lovelace",
  locale: "en",
  accepted: "true",
};

describe("register server gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminEq.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "11111111-1111-4111-8111-111111111111" }],
        error: null,
      }),
    });
    adminUpdate.mockReturnValue({ eq: adminEq });
    adminFrom.mockReturnValue({ update: adminUpdate });
    signUp.mockResolvedValue({
      data: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          identities: [{ id: "identity-1" }],
        },
      },
      error: null,
    });
  });

  it("rejects signup without the 18+ confirmation and does not create the user", async () => {
    const { register } = await import("@/actions/auth");
    const result = await register(form(patientFields));
    expect(result).toEqual({ error: ADULT_CONFIRMATION_REQUIRED_ERROR });
    expect(signUp).not.toHaveBeenCalled();
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("sets adult_confirmed_at from the service role when the confirmation is present", async () => {
    const { register } = await import("@/actions/auth");
    await expect(
      register(form({ ...patientFields, adult_confirmed: "true" }))
    ).rejects.toThrow(/REDIRECT:/);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        adult_confirmed_at: expect.any(String),
        terms_accepted_at: expect.any(String),
        privacy_accepted_at: expect.any(String),
      })
    );
    const stamp = adminUpdate.mock.calls[0][0] as {
      adult_confirmed_at: string;
      terms_accepted_at: string;
    };
    expect(stamp.adult_confirmed_at).toBe(stamp.terms_accepted_at);
  });
});

describe("acceptTerms server gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminEq.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "11111111-1111-4111-8111-111111111111" }],
        error: null,
      }),
    });
    adminUpdate.mockReturnValue({ eq: adminEq });
    adminFrom.mockReturnValue({ update: adminUpdate });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "11111111-1111-4111-8111-111111111111",
          email: "ada@example.com",
          user_metadata: { first_name: "Ada" },
        },
      },
    });
  });

  function mockProfile(role: string) {
    const single = vi.fn().mockResolvedValue({
      data: { first_name: "Ada", terms_accepted_at: null, role },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const userUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    userFrom.mockReturnValue({ select, update: userUpdate });
    return { userUpdate };
  }

  it("rejects OAuth patient completion without the confirmation", async () => {
    mockProfile("patient");
    const { acceptTerms } = await import(
      "@/app/[locale]/(auth)/accept-terms/actions"
    );
    const result = await acceptTerms(
      form({ locale: "en", next: "/en/dashboard", accepted: "true" })
    );
    expect(result).toEqual({ error: ADULT_CONFIRMATION_REQUIRED_ERROR });
    expect(adminUpdate).not.toHaveBeenCalled();
  });

  it("sets adult_confirmed_at for a patient and not for a doctor", async () => {
    mockProfile("patient");
    const { acceptTerms } = await import(
      "@/app/[locale]/(auth)/accept-terms/actions"
    );
    await expect(
      acceptTerms(
        form({
          locale: "en",
          next: "/en/dashboard",
          accepted: "true",
          adult_confirmed: "true",
        })
      )
    ).rejects.toThrow(/REDIRECT:/);
    expect(adminUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        adult_confirmed_at: expect.any(String),
      })
    );

    vi.clearAllMocks();
    adminEq.mockReturnValue({
      select: vi.fn().mockResolvedValue({
        data: [{ id: "11111111-1111-4111-8111-111111111111" }],
        error: null,
      }),
    });
    adminUpdate.mockReturnValue({ eq: adminEq });
    adminFrom.mockReturnValue({ update: adminUpdate });
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "22222222-2222-4222-8222-222222222222",
          email: "dr@example.com",
          user_metadata: {},
        },
      },
    });
    const { userUpdate } = mockProfile("doctor");
    await expect(
      acceptTerms(
        form({ locale: "en", next: "/en/doctor-dashboard", accepted: "true" })
      )
    ).rejects.toThrow(/REDIRECT:/);
    expect(adminUpdate).not.toHaveBeenCalled();
    expect(userUpdate).toHaveBeenCalledWith(
      expect.not.objectContaining({ adult_confirmed_at: expect.anything() })
    );
  });
});
