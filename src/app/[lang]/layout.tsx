import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";

import en from "@/locales/en.json";
import { isLocale, locales } from "@/lib/i18n";
import { ThemeInit } from "@/components/theme-init";
import { Toaster } from "@/components/toaster";

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const metadata: Metadata = {
  title: en.metadata.title,
  description: en.metadata.description,
};

// Reads the persisted theme preference and applies data-theme before first
// paint, so there's no flash of the wrong theme on load. See
// node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
// for why this needs to be a synchronous inline script rather than a
// Client Component / useEffect.
const themeInitScript = `(function(){try{var p=localStorage.getItem("theme")||"system";var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):p;document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      data-theme="light"
      suppressHydrationWarning
      className="h-full antialiased"
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full font-body text-ink">
        <ThemeInit />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
