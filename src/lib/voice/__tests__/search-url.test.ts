import { describe, expect, it } from "vitest";
import {
  buildDoctorsSearchPath,
  doctorsSearchPathsEqual,
  extractAssistantText,
  parseDoctorsSearchPath,
} from "@/lib/voice/search-url";

describe("buildDoctorsSearchPath", () => {
  it("builds empty doctors path", () => {
    expect(buildDoctorsSearchPath({})).toBe("/doctors");
  });

  it("maps full filter set used by Find a Doctor", () => {
    const path = buildDoctorsSearchPath({
      query: "headache",
      specialty: "neurology",
      locationSlug: "london-uk",
      language: "Turkish",
      consultationType: "video",
      skill: "migraine-management",
      minPrice: 50,
      maxPrice: 200,
      minRating: 4,
      availableToday: true,
      sort: "soonest",
      providerType: "doctor",
      placeLat: 51.5,
      placeLng: -0.1,
      placeName: "London",
      radius: 25,
    });
    expect(path.startsWith("/doctors?")).toBe(true);
    const q = new URL(path, "http://local.test").searchParams;
    expect(q.get("query")).toBe("headache");
    expect(q.get("specialty")).toBe("neurology");
    expect(q.get("location")).toBe("london-uk");
    expect(q.get("language")).toBe("Turkish");
    expect(q.get("consultationType")).toBe("video");
    expect(q.get("skill")).toBe("migraine-management");
    expect(q.get("minPrice")).toBe("50");
    expect(q.get("maxPrice")).toBe("200");
    expect(q.get("minRating")).toBe("4");
    expect(q.get("availableToday")).toBe("true");
    expect(q.get("sort")).toBe("soonest");
    expect(q.get("placeName")).toBe("London");
  });

  it("omits false booleans", () => {
    const path = buildDoctorsSearchPath({ availableToday: false });
    expect(path).toBe("/doctors");
  });
});

describe("extractAssistantText", () => {
  it("joins text parts", () => {
    expect(
      extractAssistantText([
        { type: "text", text: "Found 3 " },
        { type: "text", text: "cardiologists." },
        { type: "tool-searchDoctors" },
      ])
    ).toBe("Found 3 cardiologists.");
  });
});

describe("parseDoctorsSearchPath + equality", () => {
  it("round-trips specialty and location", () => {
    const path = buildDoctorsSearchPath({
      specialty: "general-practice",
      location: "birmingham-uk",
    });
    const parsed = parseDoctorsSearchPath(path);
    expect(parsed.specialty).toBe("general-practice");
    expect(parsed.location).toBe("birmingham-uk");
    expect(doctorsSearchPathsEqual(path, buildDoctorsSearchPath(parsed))).toBe(
      true
    );
  });
});
