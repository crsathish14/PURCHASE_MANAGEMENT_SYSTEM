import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { PROFILE_STATUS } from "@/lib/constants/profile";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { AuthShell } from "@/components/auth/auth-shell";

// Ref: Design-docs/app/login.html + request-access.html — both mockups share
// this exact two-panel shell (dark brand panel + mist auth-panel), factored
// out into AuthShell so /change-password (which can't sit inside this layout
// — see its own comment) can reuse the same look. A route group keeps this
// out of the URL and shared across /login and /request-access without
// remounting on navigation between them.
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Only a fully active user gets bounced onward — a pending/disabled
    // account may still hold a session cookie (e.g. signup left one behind
    // when email confirmation is off) but still needs to see the login form
    // to know why they can't get in, same as (staff)/layout.tsx's guard.
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, must_change_password")
      .eq("id", user.id)
      .single();

    if (profile?.status === PROFILE_STATUS.ACTIVE) {
      redirect(profile.must_change_password ? ROUTES.CHANGE_PASSWORD : ROUTES.DASHBOARD);
    }
  }

  return <AuthShell>{children}</AuthShell>;
}
