import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import { defaultLocale } from "@/lib/i18n";
import { ROUTES } from "@/lib/routes";
import { PROFILE_STATUS, USER_ROLE } from "@/lib/constants/profile";
import type { Database } from "@/lib/types/database";

const PUBLIC_PATHS = new Set<string>([ROUTES.LOGIN, ROUTES.REQUEST_ACCESS]);

function redirectTo(request: NextRequest, response: NextResponse, pathname: string) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirectResponse = NextResponse.redirect(url);
  // Carry over any cookies refreshed above — otherwise a session refresh
  // that happens on this request would be silently dropped when we return
  // a fresh redirect response instead of `response`.
  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

// Next 16 renamed `middleware.ts`/`export function middleware` to
// `proxy.ts`/`export function proxy`. See
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
//
// Runs three concerns on every request, in order:
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
//
// 3. Route gating — the *real* enforcement, not just the page-level
//    requireActiveUser()/requireAdmin() checks (src/lib/supabase/require-active-user.ts).
//    Those still run too, as defense-in-depth, but can't be relied on alone:
//    every page in this app is nested under [lang]/loading.tsx, which puts
//    rendering in a "streaming context" where redirect() only inserts a
//    client-side redirect instruction instead of a real HTTP redirect (see
//    node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md,
//    "When used in a streaming context..."). A client that doesn't execute
//    that instruction — curl, a bot, a vulnerability scanner — would
//    otherwise receive the actual protected page content with a 200. Proxy
//    runs before any rendering, so its redirect is always a real 307.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // API routes aren't part of the [lang]-prefixed page tree — locale
  // redirecting them would send /api/team to the nonexistent /en/api/team
  // instead of the actual route handler. They enforce their own auth (see
  // src/app/api/team/route.ts) rather than going through the gating below.
  if (pathname.startsWith("/api/")) {
    return response;
  }

  const hasLocale =
    pathname === `/${defaultLocale}` || pathname.startsWith(`/${defaultLocale}/`);

  let targetPathname = hasLocale ? pathname : `/${defaultLocale}${pathname}`;
  if (targetPathname === `/${defaultLocale}` || targetPathname === `/${defaultLocale}/`) {
    targetPathname = ROUTES.LOGIN;
  }

  if (targetPathname !== pathname) {
    return redirectTo(request, response, targetPathname);
  }

  if (!PUBLIC_PATHS.has(pathname)) {
    if (!user) {
      return redirectTo(request, response, ROUTES.LOGIN);
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status, must_change_password")
      .eq("id", user.id)
      .single();

    if (!profile || profile.status !== PROFILE_STATUS.ACTIVE) {
      return redirectTo(request, response, ROUTES.LOGIN);
    }

    if (profile.must_change_password && pathname !== ROUTES.CHANGE_PASSWORD) {
      return redirectTo(request, response, ROUTES.CHANGE_PASSWORD);
    }

    if (pathname === ROUTES.TEAM_ACCESS && profile.role !== USER_ROLE.ADMIN) {
      return redirectTo(request, response, ROUTES.DASHBOARD);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
