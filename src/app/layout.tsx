import type { Metadata } from "next";
import "./globals.css";

import en from "@/locales/en.json";
import { ThemeInit } from "@/components/theme-init";
import { Toaster } from "@/components/toaster";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
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
