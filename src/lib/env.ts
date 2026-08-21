import { z } from "zod";

// Client-safe env vars only (NEXT_PUBLIC_*) — this module is imported from
// both server and browser code. Validated once at import time so a missing
// or malformed var fails fast with a clear message instead of surfacing as
// a cryptic error deep inside the Supabase client.
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
});

const parsed = schema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.message}`);
}

export const env = parsed.data;
