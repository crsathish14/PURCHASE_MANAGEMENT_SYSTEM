import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

import { PROFILE_STATUS, USER_ROLE } from "@/lib/constants/profile";
import { ROUTES } from "@/lib/routes";
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
  if (!session || session.profile.status !== PROFILE_STATUS.ACTIVE) redirect(ROUTES.LOGIN);
  if (session.profile.must_change_password) redirect(ROUTES.CHANGE_PASSWORD);
  return session;
}

// For pages restricted to admins (e.g. Team & Access settings) — layer this
// on top of requireActiveUser() so an inactive/unauthenticated user gets the
// same /en/login redirect, and only an active non-admin is bounced onward.
export async function requireAdmin() {
  const session = await requireActiveUser();
  if (session.profile.role !== USER_ROLE.ADMIN) redirect(ROUTES.DASHBOARD);
  return session;
}

// Route Handler counterparts of requireActiveUser()/requireAdmin() — they
// can't call redirect() (see the comment on getSessionProfile() above), so
// these return either the session or a ready-to-return NextResponse error
// instead. Replaces the same inline auth-check block that used to be
// copy-pasted at the top of every /api route.
export async function requireApiActiveUser(): Promise<
  { session: SessionProfile; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSessionProfile();
  if (!session || session.profile.status !== PROFILE_STATUS.ACTIVE) {
    return {
      error: NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 }),
    };
  }
  return { session };
}

export async function requireApiAdmin(): Promise<
  { session: SessionProfile; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const result = await requireApiActiveUser();
  if (result.error) return result;
  if (result.session.profile.role !== USER_ROLE.ADMIN) {
    return {
      error: NextResponse.json({ error: { message: "Admin access required." } }, { status: 403 }),
    };
  }
  return result;
}
