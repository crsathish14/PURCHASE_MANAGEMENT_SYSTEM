import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/types/database";

// Service-role client — bypasses RLS entirely. Server-only: never import
// this from a Client Component, and never expose SUPABASE_SERVICE_ROLE_KEY
// to the browser. Used to create invited users (needs auth.admin.createUser)
// and to clear a profile's own must_change_password flag after a successful
// password change, where RLS deliberately grants no self-update policy.
export function createAdminClient() {
  return createClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
