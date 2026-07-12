import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// A layout's redirect() does not stop a page's own render from executing —
// Next.js resolves `children` independently of the layout, so the page's
// RSC payload can still be computed and streamed even when a parent layout
// redirects (see node_modules/next/dist/docs/01-app/02-guides/data-security.md,
// "Authentication and authorization" — the check must live in the page
// itself, not just an ancestor layout). Every page under (staff) must call
// this directly, not just rely on (staff)/layout.tsx calling it.
export async function requireActiveUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/en/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") redirect("/en/login");

  return { user, profile };
}
