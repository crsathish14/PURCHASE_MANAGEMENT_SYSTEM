import type { Metadata } from "next";

import "./globals.css";
import { Button } from "@/components/atoms";
import { defaultLocale } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import en from "@/locales/en.json";

// Catches genuinely unmatched URLs (no route matched at all) — see the
// `globalNotFound` flag in next.config.ts for why this is needed instead of
// a plain app/not-found.tsx when the root layout lives at app/[lang]/layout.tsx.
// This file bypasses normal rendering entirely, so it needs its own
// <html>/<body> and can't rely on [lang]/layout.tsx or ThemeInit.
const themeInitScript = `(function(){try{var p=localStorage.getItem("theme")||"system";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export const metadata: Metadata = {
  title: en.notFound.title,
};

export default function GlobalNotFound() {
  return (
    <html
      lang={defaultLocale}
      data-theme="light"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full font-body text-ink">
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-mist px-6 text-center">
          <p className="font-display text-3xl font-semibold text-ink">404</p>
          <p className="text-sm text-slate">{en.notFound.description}</p>
          <a href={ROUTES.LOGIN}>
            <Button variant="secondary" size="sm">
              {en.notFound.action}
            </Button>
          </a>
        </div>
      </body>
    </html>
  );
}
