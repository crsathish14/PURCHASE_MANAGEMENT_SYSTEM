import type { Metadata } from "next";

import en from "@/locales/en.json";

import { RequestAccessForm } from "./request-access-form";

export const metadata: Metadata = {
  title: `${en.auth.requestAccess.title} — ${en.auth.brand.word}`,
};

export default function RequestAccessPage() {
  return (
    <div className="w-full max-w-[420px] rounded-lg border border-line bg-paper p-8 pb-7 shadow-(--shadow-e2)">
      <RequestAccessForm />
    </div>
  );
}
