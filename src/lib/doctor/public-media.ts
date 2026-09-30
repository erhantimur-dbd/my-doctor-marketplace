/** Public doctor photos and intro videos. The bucket name is not "public". */
export const DOCTOR_PUBLIC_MEDIA_BUCKET = "public-read";

export type DoctorPublicMediaKind = "doctor-photos" | "doctor-videos";

/**
 * Object key inside the public-read bucket.
 * The first folder is the authenticated user id so storage.objects policies match.
 */
export function doctorPublicMediaObjectPath(
  userId: string,
  kind: DoctorPublicMediaKind,
  fileName: string,
): string {
  const safeName = fileName.replace(/^\/+/, "");
  return `${userId}/${kind}/${safeName}`;
}

/** Value stored on doctor_photos.storage_path and doctors.profile_video_path. */
export function doctorPublicMediaStoragePath(objectPath: string): string {
  return `${DOCTOR_PUBLIC_MEDIA_BUCKET}/${objectPath}`;
}

/** Strip the bucket prefix so storage.remove receives the object key. */
export function doctorPublicMediaObjectKey(storagePath: string): string {
  const prefix = `${DOCTOR_PUBLIC_MEDIA_BUCKET}/`;
  if (storagePath.startsWith(prefix)) return storagePath.slice(prefix.length);
  if (storagePath.startsWith("public/")) return storagePath.slice("public/".length);
  return storagePath;
}
