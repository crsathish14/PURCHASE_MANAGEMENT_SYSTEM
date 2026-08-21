import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import type { ProfileStatus, UserRole } from "@/lib/types/database";

type SessionProfile = {
  user: User;
  profile: {
    full_name: string | null;
    role: UserRole;
    status: ProfileStatus;
    must_change_password: boolean;
  };
};

// Route Handlers can't redirect() the way pages can, so they need the raw
// session/profile lookup without the page-oriented redirect behavior below.
export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, status, must_change_password")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return { user, profile };
}

// A layout's redirect() does not stop a page's own render from executing —
// Next.js resolves `children` independently of the layout, so the page's
// RSC payload can still be computed and streamed even when a parent layout
// redirects (see node_modules/next/dist/docs/01-app/02-guides/data-security.md,
// "Authentication and authorization" — the check must live in the page
// itself, not just an ancestor layout). Every page under (staff) must call
// this directly, not just rely on (staff)/layout.tsx calling it.
export async function requireActiveUser() {
  const session = await getSessionProfile();
  if (!session || session.profile.status !== "active") redirect("/en/login");
  if (session.profile.must_change_password) redirect("/en/change-password");
  return session;
}

// For pages restricted to admins (e.g. Team & Access settings) — layer this
// on top of requireActiveUser() so an inactive/unauthenticated user gets the
// same /en/login redirect, and only an active non-admin is bounced onward.
export async function requireAdmin() {
  const session = await requireActiveUser();
  if (session.profile.role !== "admin") redirect("/en/dashboard");
  return session;
}
