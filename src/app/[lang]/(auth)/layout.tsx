import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import en from "@/locales/en.json";
import { PROFILE_STATUS } from "@/lib/constants/profile";
import { ROUTES } from "@/lib/routes";
import { createClient } from "@/lib/supabase/server";
import { AnchorIcon } from "@/components/auth/icons";

// Ref: Design-docs/app/login.html + request-access.html — both mockups share
// this exact two-panel shell (dark brand panel + mist auth-panel). A route
// group keeps it out of the URL and shared across /login and /request-access
// without remounting on navigation between them.
//
// The brand panel is always dark regardless of the site's light/dark theme —
// same reasoning as Avatar's fixed gradient (src/components/atoms/avatar.tsx):
// it's a fixed brand surface, not a themed one, so colors are hardcoded here
// rather than using the semantic tokens.
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Only a fully active user gets bounced onward — a pending/disabled
    // account may still hold a session cookie (e.g. signup left one behind
    // when email confirmation is off) but still needs to see the login form
    // to know why they can't get in, same as (staff)/layout.tsx's guard.
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, must_change_password")
      .eq("id", user.id)
      .single();

    if (profile?.status === PROFILE_STATUS.ACTIVE) {
      redirect(profile.must_change_password ? ROUTES.CHANGE_PASSWORD : ROUTES.DASHBOARD);
    }
  }

  const { brand } = en.auth;

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:flex-row">
      <div className="flex min-w-0 flex-col overflow-hidden bg-[linear-gradient(175deg,#0B2A4A_0%,#08213B_100%)] px-6 py-8 text-[#DCE4F2] lg:basis-3/5 lg:px-13 lg:py-11">
        <div className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-harbor text-white">
            <AnchorIcon className="h-[15px] w-[15px]" />
          </span>
          <span className="font-display text-base text-white">{brand.word}</span>
        </div>

        <div className="mt-7 max-w-[440px] lg:mt-16">
          <h1 className="font-display text-[32px] leading-[1.25] font-semibold text-balance text-white">
            {brand.headline}
          </h1>
          <p className="mt-3.5 text-sm leading-relaxed text-[#A9BAD6]">{brand.subtext}</p>
        </div>

        <div className="mt-9 hidden h-[220px] lg:block" aria-hidden="true">
          <PortArt />
        </div>

        <div className="mt-6 flex gap-8 border-t border-white/10 pt-6 lg:mt-auto">
          <Stat value="3" label={brand.stats.vessels} />
          <Stat value="214" label={brand.stats.pos} />
          <Stat value="42" label={brand.stats.vendors} />
        </div>
      </div>

      <div className="flex-1 bg-mist lg:min-h-0 lg:overflow-y-auto">
        <div className="flex min-h-full items-center justify-center px-6 py-10">{children}</div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <b className="font-display block text-[22px] font-semibold text-white">{value}</b>
      <span className="mt-[3px] block text-[11.5px] text-[#8FA2C4]">{label}</span>
    </div>
  );
}

function PortArt() {
  const route = { fill: "none", stroke: "var(--color-teal)", strokeOpacity: 0.55, strokeWidth: 1.5, strokeDasharray: "4 5" };
  const port = { fill: "#0B2A4A", stroke: "var(--color-harbor-lt)", strokeWidth: 1.6 };

  return (
    <svg viewBox="0 0 480 220" preserveAspectRatio="xMidYMid meet" className="h-full w-full">
      <path d="M70 60 Q150 10 230 40" {...route} />
      <path d="M230 40 Q290 90 350 110" {...route} />
      <path d="M350 110 Q385 150 405 190" {...route} />
      <path d="M150 190 Q195 100 230 40" {...route} />
      <circle cx="70" cy="60" r="5" {...port} />
      <circle cx="230" cy="40" r="5" {...port} />
      <circle cx="350" cy="110" r="6.5" {...port} />
      <circle cx="350" cy="110" r="2.5" fill="var(--color-harbor-lt)" />
      <circle cx="405" cy="190" r="5" {...port} />
      <circle cx="150" cy="190" r="5" {...port} />
      <g transform="translate(268,84) rotate(18)">
        <path d="M-16 6h32l-5 11h-22Z" stroke="#DCE4F2" strokeWidth={1.4} fill="none" />
        <path d="M-6 6V-8h4v-4h5v4h4v14" stroke="#DCE4F2" strokeWidth={1.4} fill="none" />
      </g>
    </svg>
  );
}
