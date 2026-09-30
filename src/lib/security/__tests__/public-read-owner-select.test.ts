import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(rel: string): string {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

const migration = read("supabase/migrations/00136_public_read_owner_select.sql");

describe("00136 public-read owner select", () => {
  it("drops the public SELECT policy and creates the owner-scoped one", () => {
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Public-read media is publicly accessible" ON storage.objects;'
    );
    expect(migration).not.toMatch(
      /CREATE POLICY "Public-read media is publicly accessible"/
    );

    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Users can read own public-read media" ON storage.objects;'
    );
    expect(migration).toMatch(
      /CREATE POLICY "Users can read own public-read media"\s+ON storage\.objects\s+FOR SELECT\s+TO authenticated\s+USING \(\s*bucket_id = 'public-read'\s+AND auth\.uid\(\)::text = \(storage\.foldername\(name\)\)\[1\]\s*\)/
    );
  });
});
