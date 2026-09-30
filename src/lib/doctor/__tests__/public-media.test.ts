import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOCTOR_PUBLIC_MEDIA_BUCKET,
  doctorPublicMediaObjectKey,
  doctorPublicMediaObjectPath,
  doctorPublicMediaStoragePath,
} from "@/lib/doctor/public-media";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const userId = "11111111-1111-1111-1111-111111111111";
const doctorId = "22222222-2222-2222-2222-222222222222";

describe("doctor public media paths", () => {
  it("puts the authenticated user id in the first folder", () => {
    const objectPath = doctorPublicMediaObjectPath(
      userId,
      "doctor-photos",
      "1710000000000-abc.jpg",
    );
    expect(objectPath.startsWith(`${userId}/doctor-photos/`)).toBe(true);
    expect(objectPath).not.toContain("doctor-photos/" + doctorId);
    expect(doctorPublicMediaStoragePath(objectPath)).toBe(
      `${DOCTOR_PUBLIC_MEDIA_BUCKET}/${objectPath}`,
    );
  });

  it("keeps the doctor id inside a video object key", () => {
    const objectPath = doctorPublicMediaObjectPath(
      userId,
      "doctor-videos",
      `${doctorId}/1710000000000.mp4`,
    );
    expect(objectPath).toBe(
      `${userId}/doctor-videos/${doctorId}/1710000000000.mp4`,
    );
    expect(doctorPublicMediaStoragePath(objectPath)).toContain(doctorId);
  });

  it("strips the bucket prefix before storage.remove", () => {
    const objectPath = `${userId}/doctor-photos/a.jpg`;
    expect(
      doctorPublicMediaObjectKey(`${DOCTOR_PUBLIC_MEDIA_BUCKET}/${objectPath}`),
    ).toBe(objectPath);
    expect(doctorPublicMediaObjectKey(`public/${objectPath}`)).toBe(objectPath);
  });
});

describe("public-read bucket migration", () => {
  const sql = read("supabase/migrations/00129_doctor_media_bucket.sql");

  it("creates the public-read bucket and owner-only write policies", () => {
    expect(sql).toContain("'public-read'");
    expect(sql).toContain("52428800");
    expect(sql).toContain("'image/jpeg'");
    expect(sql).toContain("'image/png'");
    expect(sql).toContain("'image/webp'");
    expect(sql).toContain("auth.uid()::text = (storage.foldername(name))[1]");
    expect(sql).toContain('FOR INSERT');
    expect(sql).toContain("WITH CHECK");
    expect(sql).toContain('FOR UPDATE');
    expect(sql).toContain('FOR DELETE');
    expect(sql).toContain("bucket_id = 'public-read'");
    expect(sql).not.toMatch(/bucket_id = 'public'/);
  });
});

describe("doctor media upload callers", () => {
  const photos = read("src/components/doctor/practice-photos-manager.tsx");
  const video = read("src/components/doctor/profile-marketplace-fields.tsx");

  it("uploads practice photos to public-read under the signed-in user", () => {
    expect(photos).not.toMatch(/\.from\(["']public["']\)/);
    expect(photos).toContain("doctorPublicMediaObjectPath");
    expect(photos).toContain('"doctor-photos"');
    expect(photos).toContain("DOCTOR_PUBLIC_MEDIA_BUCKET");
    expect(photos).toContain("auth.getUser()");
  });

  it("uploads profile videos to the same bucket and still includes the doctor id", () => {
    expect(video).not.toMatch(/\.from\(["']public["']\)/);
    expect(video).toContain("doctorPublicMediaObjectPath");
    expect(video).toContain('"doctor-videos"');
    expect(video).toContain("`${doctorId}/");
    expect(video).toContain("submitProfileVideo(storagePath)");
  });
});
