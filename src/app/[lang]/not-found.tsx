import Link from "next/link";

import { Button } from "@/components/atoms";
import { defaultLocale } from "@/lib/i18n";
import en from "@/locales/en.json";

export const metadata = {
  title: en.notFound.title,
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-mist px-6 text-center">
      <p className="font-display text-3xl font-semibold text-ink">404</p>
      <p className="text-sm text-slate">{en.notFound.description}</p>
      <Link href={`/${defaultLocale}`}>
        <Button variant="secondary" size="sm">
          {en.notFound.action}
        </Button>
      </Link>
    </div>
  );
}
