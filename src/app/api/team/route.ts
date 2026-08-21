import { NextResponse } from "next/server";

import { PROFILE_STATUS, USER_ROLE } from "@/lib/constants/profile";
import { getTeamMembers } from "@/lib/data/team";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { SELECT_COLUMNS, toTeamMember } from "./shared";

// Admin-only: lists everyone in profiles for the Team & Access settings page.
export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  try {
    const members = await getTeamMembers();
    return NextResponse.json({
      data: members,
      meta: {
        total: members.length,
        pending: members.filter((m) => m.status === PROFILE_STATUS.PENDING).length,
        disabled: members.filter((m) => m.status === PROFILE_STATUS.DISABLED).length,
      },
    });
  } catch (error) {
    console.error("[api/team:GET]", error);
    return NextResponse.json({ error: { message: "Couldn't load team members." } }, { status: 500 });
  }
}

// Admin-only: creates a new account directly (name, email, admin-set
// password, role) instead of the self-serve request-access flow. The
// account is active immediately — no separate approval step — and its
// email is auto-confirmed since the admin is vouching for it.
export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const { fullName, email, password, role, requirePasswordReset } = (body ?? {}) as {
    fullName?: unknown;
    email?: unknown;
    password?: unknown;
    role?: unknown;
    requirePasswordReset?: unknown;
  };

  if (typeof fullName !== "string" || fullName.trim().length === 0) {
    return NextResponse.json({ error: { message: "Full name is required." } }, { status: 400 });
  }
  if (typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json({ error: { message: "Email is required." } }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: { message: "Password must be at least 8 characters." } },
      { status: 400 },
    );
  }
  if (role !== USER_ROLE.ADMIN && role !== USER_ROLE.OFFICER) {
    return NextResponse.json({ error: { message: "Invalid role." } }, { status: 400 });
  }
  const mustChangePassword = requirePasswordReset !== false;

  const adminClient = createAdminClient();
  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError || !created.user) {
    console.error("[api/team:POST] createUser failed", createError);
    return NextResponse.json(
      { error: { message: createError?.message ?? "Couldn't create this account." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role, status: PROFILE_STATUS.ACTIVE, must_change_password: mustChangePassword })
    .eq("id", created.user.id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[api/team:POST] profile update failed", error);
    return NextResponse.json(
      {
        error: {
          message: "The account was created but setup didn't finish. Try updating this person from the table, or contact support.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: toTeamMember(data) }, { status: 201 });
}
