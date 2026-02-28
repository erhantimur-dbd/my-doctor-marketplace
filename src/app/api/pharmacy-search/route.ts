import { NextRequest, NextResponse } from "next/server";

// Loose UK postcode regex — accepts full or partial postcodes
const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

interface NHSContact {
  ContactType: string;
  ContactValue: string;
  ContactMethodType: string;
  ContactAvailabilityType: string;
}

interface NHSOpeningDay {
  Weekday: string;
  Times: string;
  OffsetOpeningTime: number;
  OffsetClosingTime: number;
  OpeningTime: string;
  ClosingTime: string;
  IsOpen: boolean;
}

interface NHSPharmacyResult {
  ODSCode: string;
  OrganisationName: string;
  OrganisationType: string;
  OrganisationSubType: string;
  Address1: string;
  Address2: string;
  Address3: string;
  City: string;
  County: string;
  Postcode: string;
  Latitude: number;
  Longitude: number;
  Contacts: NHSContact[] | null;
  OpeningTimesV2: { Weekday: NHSOpeningDay[] } | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { postcode } = body;

    // Validate input
    if (!postcode || typeof postcode !== "string") {
      return NextResponse.json(
        { error: "Postcode is required" },
        { status: 400 }
      );
    }

    const trimmed = postcode.trim().toUpperCase();
    if (!UK_POSTCODE_REGEX.test(trimmed)) {
      return NextResponse.json(
        { error: "Please enter a valid UK postcode (e.g. SW1A 1AA)" },
        { status: 400 }
      );
    }

    const apiKey = process.env.NHS_SERVICE_SEARCH_API_KEY;
    if (!apiKey) {
      console.error("NHS_SERVICE_SEARCH_API_KEY not configured");
      return NextResponse.json(
        {
          error:
            "Pharmacy search is temporarily unavailable. Please try again later.",
        },
        { status: 503 }
      );
    }

    // Use the outward code (first half) for broader search coverage
    const normalised = trimmed.replace(/\s+/g, " ");
    const outwardCode = normalised.split(" ")[0];

    // Call NHS Directory of Healthcare Services API v3
    const nhsUrl = "https://api.service.nhs.uk/service-search-api";
    const nhsResponse = await fetch(`${nhsUrl}?api-version=3`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        filter: `OrganisationTypeId eq 'PHA'`,
        search: outwardCode,
        searchFields: "Postcode",
        searchMode: "all",
        select:
          "ODSCode,OrganisationName,OrganisationSubType,Address1,Address2,Address3,City,County,Postcode,Latitude,Longitude,Contacts,OpeningTimesV2",
        top: 25,
        skip: 0,
        count: true,
        orderby: "search.score() desc",
      }),
    });

    if (!nhsResponse.ok) {
      const text = await nhsResponse.text();
      console.error("NHS API error:", nhsResponse.status, text);
      return NextResponse.json(
        { error: "Failed to search pharmacies. Please try again." },
        { status: 502 }
      );
    }

    const data = await nhsResponse.json();

    // Transform NHS response into clean Pharmacy objects
    const pharmacies = (data.value || []).map((p: NHSPharmacyResult) => ({
      id: p.ODSCode,
      name: p.OrganisationName,
      address: [p.Address1, p.Address2, p.Address3, p.City, p.County]
        .filter(Boolean)
        .join(", "),
      postcode: p.Postcode,
      lat: p.Latitude,
      lng: p.Longitude,
      phone:
        p.Contacts?.find(
          (c) =>
            c.ContactMethodType === "Telephone" ||
            c.ContactType === "Primary"
        )?.ContactValue || null,
      website:
        p.Contacts?.find((c) => c.ContactMethodType === "Website")
          ?.ContactValue || null,
      openingTimes: p.OpeningTimesV2?.Weekday || [],
      subType: p.OrganisationSubType || null,
    }));

    return NextResponse.json({
      pharmacies,
      total: data["@odata.count"] ?? pharmacies.length,
    });
  } catch (error) {
    console.error("Pharmacy search error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
