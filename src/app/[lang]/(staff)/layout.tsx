import type { ReactNode } from "react";

import { requireActiveUser } from "@/lib/supabase/require-active-user";
import { StaffShell } from "@/components/staff/staff-shell";

// Real access control for the authenticated area — the login form's own
// profiles.status check (src/app/[lang]/(auth)/login/login-form.tsx) is only
// a client-side UX nicety, not enforcement. This provides the shell's
// name/role display and a first line of defense, but does NOT by itself stop
// a page's own content from rendering — see the comment on
// requireActiveUser(): every page must call it too, independently.
export default async function StaffLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireActiveUser();

  return (
    <StaffShell fullName={profile.full_name} role={profile.role}>
      {children}
    </StaffShell>
  );
}
