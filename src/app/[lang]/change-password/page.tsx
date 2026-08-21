import type { Metadata } from "next";
import { redirect } from "next/navigation";

import en from "@/locales/en.json";
import { getSessionProfile } from "@/lib/supabase/require-active-user";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

const t = en.changePassword;

export const metadata: Metadata = {
  title: `${t.title} — ${en.auth.brand.word}`,
};

export default async function ChangePasswordPage() {
  // Deliberately not requireActiveUser() — that redirects here whenever
  // must_change_password is set, so calling it from this page would loop.
  // Just needs a real, active session; whether the flag is set or not, an
  // active user is always allowed to land here.
  const session = await getSessionProfile();
  if (!session) redirect("/en/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-6 py-10">
      <div className="w-full max-w-md rounded-xl border border-line bg-paper p-7 shadow-(--shadow-e1)">
        <h1 className="font-display text-[23px] font-semibold text-ink">{t.title}</h1>
        <p className="mt-2 mb-6.5 text-[13px] leading-relaxed text-slate">{t.description}</p>
        <ChangePasswordForm email={session.user.email ?? ""} />
      </div>
    </div>
  );
}
