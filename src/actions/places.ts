"use server";

/**
 * Server-side Google Places Autocomplete + Details.
 *
 * Runs on the server to avoid CORS issues with the Places API.
 * Uses the same Google Maps API key as the rest of the app.
 */

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

/**
 * Search for places using Google Places Autocomplete.
 * Returns up to 5 predictions matching the input text.
 */
export async function searchPlaces(
  input: string
): Promise<PlacePrediction[]> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey || input.trim().length < 2) return [];

  try {
    const encoded = encodeURIComponent(input.trim());
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encoded}&types=geocode&key=${apiKey}`,
      { cache: "no-store" }
    );
    const json = await res.json();

    if (json.status !== "OK" || !json.predictions) return [];

    return (json.predictions as Record<string, unknown>[])
      .slice(0, 5)
      .map((p: Record<string, unknown>) => ({
        placeId: p.place_id as string,
        description: p.description as string,
        mainText:
          (p.structured_formatting as Record<string, string>)?.main_text ||
          (p.description as string),
        secondaryText:
          (p.structured_formatting as Record<string, string>)
            ?.secondary_text || "",
      }));
  } catch {
    return [];
  }
}

/**
 * Get the lat/lng coordinates for a place by its Place ID.
 */
export async function getPlaceCoordinates(
  placeId: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${apiKey}`,
      { cache: "no-store" }
    );
    const json = await res.json();

    if (
      json.status !== "OK" ||
      !json.result?.geometry?.location
    )
      return null;

    return {
      lat: json.result.geometry.location.lat as number,
      lng: json.result.geometry.location.lng as number,
    };
  } catch {
    return null;
  }
}
