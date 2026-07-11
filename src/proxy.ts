import { NextResponse, type NextRequest } from "next/server";

import { defaultLocale } from "@/lib/i18n";

// Next 16 renamed `middleware.ts`/`export function middleware` to
// `proxy.ts`/`export function proxy`. See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// Redirects any path without a locale prefix to /en, per the routing
// pattern in node_modules/next/dist/docs/01-app/02-guides/internationalization.md.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasLocale =
    pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`);
  if (hasLocale) return;

  const url = request.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
