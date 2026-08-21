import { z } from "zod";

// Server-only secret — import this only from src/lib/supabase/admin.ts.
// Never import it from a Client Component or anything that ends up in the
// browser bundle.
const schema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

const parsed = schema.safeParse({
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
});

if (!parsed.success) {
  throw new Error(`Invalid environment variables:\n${parsed.error.message}`);
}

export const serverEnv = parsed.data;
