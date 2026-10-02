/**
 * Columns of public.public_organizations, from migration 00128.
 * Service-role readers of public.organizations must stay inside this list.
 * There is no status, is_active, published, or verified column on
 * public.organizations (00047, 00076, 00121, 00133).
 */
export const PUBLIC_ORGANIZATION_COLUMNS = [
  "id",
  "name",
  "slug",
  "logo_url",
  "cover_image_url",
  "description",
  "website",
  "specialties",
  "seo_title",
  "seo_description",
  "brand_display_name",
  "brand_primary_color",
  "brand_secondary_color",
  "brand_accent_color",
  "brand_favicon_url",
  "brand_hide_platform_badge",
] as const;

export type PublicOrganizationColumn = (typeof PUBLIC_ORGANIZATION_COLUMNS)[number];

const ALLOWED_PUBLIC_ORGANIZATION_COLUMNS = new Set<string>(PUBLIC_ORGANIZATION_COLUMNS);

/** Reject select('*') and any column the public view does not expose. */
export function publicOrganizationSelectList(columns: string): string {
  const parts = columns
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("organization select list is empty");
  }
  for (const part of parts) {
    if (part.includes("*") || part.includes("(") || part.includes(")")) {
      throw new Error(`organization select must be an explicit column list, got ${part}`);
    }
    if (!ALLOWED_PUBLIC_ORGANIZATION_COLUMNS.has(part)) {
      throw new Error(`organization column is not public: ${part}`);
    }
  }
  return parts.join(", ");
}

/** generateMetadata on /clinics/[slug]. Same columns as the view read today. */
export const CLINIC_METADATA_ORGANIZATION_COLUMNS = publicOrganizationSelectList(
  "name, description, seo_title, seo_description, logo_url, slug, cover_image_url"
);

/** Clinic page body. Same columns as the view read today. */
export const CLINIC_PAGE_ORGANIZATION_COLUMNS = publicOrganizationSelectList(
  "id, name, slug, logo_url, cover_image_url, description, website, specialties, seo_title, seo_description, brand_display_name, brand_favicon_url"
);

/** Public /invite/[token] card. Same columns as the view read today. */
export const CLINIC_INVITE_ORGANIZATION_COLUMNS = publicOrganizationSelectList(
  "id, name, slug, logo_url"
);

/** Invitation banner. Same column as the view read today. */
export const INVITED_MEMBER_ORGANIZATION_COLUMNS = publicOrganizationSelectList("name");

export type PublicClinicMetadata = {
  name: string;
  description: string | null;
  seo_title: string | null;
  seo_description: string | null;
  logo_url: string | null;
  slug: string;
  cover_image_url: string | null;
};

export type PublicClinicPageOrganization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  website: string | null;
  specialties: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  brand_display_name: string | null;
  brand_favicon_url: string | null;
};

export type ClinicInviteOrganization = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};
