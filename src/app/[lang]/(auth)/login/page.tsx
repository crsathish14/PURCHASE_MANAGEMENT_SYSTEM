import type { Metadata } from "next";

import en from "@/locales/en.json";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: `${en.auth.login.title} — ${en.auth.brand.word}`,
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-[380px] rounded-lg border border-line bg-paper p-8 pb-7 shadow-(--shadow-e2)">
      <LoginForm />
    </div>
  );
}
