export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateDoctorSlug(
  title: string | null,
  firstName: string,
  lastName: string,
  city: string
): string {
  const parts = [title, firstName, lastName, city].filter(Boolean);
  return generateSlug(parts.join(" "));
}
