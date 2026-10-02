import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  CLINIC_METADATA_ORGANIZATION_COLUMNS,
  CLINIC_PAGE_ORGANIZATION_COLUMNS,
  publicOrganizationSelectList,
  type PublicClinicMetadata,
  type PublicClinicPageOrganization,
} from "@/lib/organizations/public-columns";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Public clinic page read. organizations has no published, active, or
 * verified flag, so this filters on slug only. The page still returns 404
 * when the slug misses, and still applies the existing license check.
 */
async function loadPublicClinicBySlug<T>(
  slug: string,
  columns: string,
  admin: AdminClient
): Promise<T | null> {
  const select = publicOrganizationSelectList(columns);
  const { data } = await admin
    .from("organizations")
    .select(select)
    .eq("slug", slug)
    .single();
  return (data ?? null) as T | null;
}

export function loadPublicClinicMetadata(
  slug: string,
  admin: AdminClient = createAdminClient()
) {
  return loadPublicClinicBySlug<PublicClinicMetadata>(
    slug,
    CLINIC_METADATA_ORGANIZATION_COLUMNS,
    admin
  );
}

export async function loadPublicClinicPage(
  slug: string,
  admin: AdminClient = createAdminClient()
) {
  const org = await loadPublicClinicBySlug<PublicClinicPageOrganization>(
    slug,
    CLINIC_PAGE_ORGANIZATION_COLUMNS,
    admin
  );
  if (!org?.id) return null;
  return org;
}
