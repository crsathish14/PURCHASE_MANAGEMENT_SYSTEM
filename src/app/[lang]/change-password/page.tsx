import type { Metadata } from "next";
import { redirect } from "next/navigation";

import en from "@/locales/en.json";
import { ROUTES } from "@/lib/routes";
import { getSessionProfile } from "@/lib/supabase/require-active-user";
import { AuthShell } from "@/components/auth/auth-shell";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

const t = en.changePassword;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function ChangePasswordPage() {
  // Deliberately not requireActiveUser() — that redirects here whenever
  // must_change_password is set, so calling it from this page would loop.
  // Just needs a real, active session; whether the flag is set or not, an
  // active user is always allowed to land here. Also why this page renders
  // AuthShell directly rather than living inside (auth)/layout.tsx — that
  // layout's own redirect logic would loop for exactly this user.
  const session = await getSessionProfile();
  if (!session) redirect(ROUTES.LOGIN);

  return (
    <AuthShell>
      <div className="w-full max-w-[380px] rounded-lg border border-line bg-paper p-8 pb-7 shadow-(--shadow-e2)">
        <h2 className="font-display text-[23px] font-semibold text-ink">{t.title}</h2>
        <div className="mt-3.5 mb-6 h-px bg-line" />
        <p className="mb-6 text-[13px] leading-relaxed text-slate">{t.description}</p>
        <ChangePasswordForm email={session.user.email ?? ""} />
      </div>
    </AuthShell>
  );
}
