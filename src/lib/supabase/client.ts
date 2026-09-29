import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Passkeys are enabled by default in supabase-js ≥ 2.105; keep the
        // experimental flag so older docs/snippets remain valid.
        experimental: { passkey: true },
      },
    }
  );
}
