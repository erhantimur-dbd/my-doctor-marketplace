import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const migration = read("supabase/migrations/00137_avatars_no_anon_list.sql");

describe("00137 avatars no anon list", () => {
  it("drops the public SELECT policy and creates the owner-scoped one", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;'
    );
    expect(migration).not.toMatch(
      /CREATE POLICY "Avatar images are publicly accessible"/
    );

    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can read own avatar" ON storage.objects;'
    );
    expect(migration).toMatch(
      /CREATE POLICY "Users can read own avatar"\s+ON storage\.objects\s+FOR SELECT\s+TO authenticated\s+USING \(\s*bucket_id = 'avatars'\s+AND auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]\s*\)/
    );
  });
});
