import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { defaultLocale } from "@/lib/i18n";
import type { Database } from "@/lib/types/database";

// Next 16 renamed `middleware.ts`/`export function middleware` to
// `proxy.ts`/`export function proxy`. See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// Runs two concerns on every request, in order:
//
// 1. Supabase session refresh. Server Components can't write cookies during
//    render (see the try/catch in src/lib/supabase/server.ts), so if the
//    access token is already expired by the time one runs, the refreshed
//    token has nowhere to be persisted back to. Calling
//    supabase.auth.getUser() here — before any page renders — refreshes the
//    token if needed and writes the updated cookies onto the response.
//
// 2. Locale-prefix redirect, per the routing pattern in
//    node_modules/next/dist/docs/01-app/02-guides/internationalization.md.
//    The site root (with or without a locale prefix) always means "sign in"
//    now — there's no marketing/demo home page anymore, and /[lang]/dashboard
//    is guarded, so sending logged-out root visitors straight to /login
//    skips a redundant bounce through the guard.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Must actually be called — this is what triggers the refresh and, via
  // setAll above, writes it back onto `response`. getUser() (not
  // getSession()) is used because it revalidates against the Auth server
  // instead of trusting a potentially-stale local JWT.
  await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const hasLocale =
    pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`);

  let targetPathname = hasLocale ? pathname : `/${defaultLocale}${pathname}`;
  if (targetPathname === `/${defaultLocale}` || targetPathname === `/${defaultLocale}/`) {
    targetPathname = `/${defaultLocale}/login`;
  }

  if (targetPathname !== pathname) {
    const url = request.nextUrl.clone();
    url.pathname = targetPathname;
    const redirectResponse = NextResponse.redirect(url);
    // Carry over any cookies refreshed above — otherwise a session refresh
    // that happens on this request would be silently dropped when we return
    // a fresh redirect response instead of `response`.
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
