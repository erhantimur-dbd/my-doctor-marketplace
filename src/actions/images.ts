"use server";
import { log } from "@/lib/utils/logger";


/**
 * Search royalty-free images from Pexels.
 * Requires PEXELS_API_KEY environment variable.
 * Free tier: 200 requests/month, no billing needed.
 * @see https://www.pexels.com/api/
 */

interface PexelsPhoto {
  id: number;
  url: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    tiny: string;
  };
  alt: string;
}

export interface ImageSearchResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  photographer: string;
  photographerUrl: string;
  alt: string;
  source: "pexels";
}

export async function searchCoverImages(
  query: string,
  page = 1,
  perPage = 9
): Promise<{ images: ImageSearchResult[]; error?: string }> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return {
      images: [],
      error:
        "Pexels API key not configured. Add PEXELS_API_KEY to your environment variables. Get a free key at pexels.com/api/",
    };
  }

  if (!query.trim()) {
    return { images: [], error: "Search query is empty" };
  }

  try {
    const params = new URLSearchParams({
      query: query.trim(),
      per_page: String(perPage),
      page: String(page),
      orientation: "landscape",
    });

    const res = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 3600 }, // Cache for 1 hour
      }
    );

    if (!res.ok) {
      if (res.status === 401) {
        return { images: [], error: "Invalid Pexels API key" };
      }
      return {
        images: [],
        error: `Pexels API error (${res.status})`,
      };
    }

    const data = await res.json();
    const photos: PexelsPhoto[] = data.photos || [];

    return {
      images: photos.map((p) => ({
        id: String(p.id),
        url: p.src.large2x,
        thumbnailUrl: p.src.medium,
        photographer: p.photographer,
        photographerUrl: p.photographer_url,
        alt: p.alt || query,
        source: "pexels" as const,
      })),
    };
  } catch (err) {
    log.error("Pexels search error:", { err: err });
    return { images: [], error: "Failed to search images" };
  }
}
