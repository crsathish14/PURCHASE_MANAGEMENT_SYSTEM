import { NextResponse } from "next/server";

import { getTeamMembers } from "@/lib/data/team";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/require-active-user";
import { SELECT_COLUMNS, toTeamMember } from "./shared";

// Admin-only: lists everyone in profiles for the Team & Access settings page.
export async function GET() {
  const session = await getSessionProfile();

  if (!session || session.profile.status !== "active") {
    return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });
  }
  if (session.profile.role !== "admin") {
    return NextResponse.json({ error: { message: "Admin access required." } }, { status: 403 });
  }

  try {
    const members = await getTeamMembers();
    return NextResponse.json({
      data: members,
      meta: {
        total: members.length,
        pending: members.filter((m) => m.status === "pending").length,
        disabled: members.filter((m) => m.status === "disabled").length,
      },
    });
  } catch {
    return NextResponse.json({ error: { message: "Couldn't load team members." } }, { status: 500 });
  }
}

// Admin-only: creates a new account directly (name, email, admin-set
// password, role) instead of the self-serve request-access flow. The
// account is active immediately — no separate approval step — and its
// email is auto-confirmed since the admin is vouching for it.
export async function POST(request: Request) {
  const session = await getSessionProfile();

  if (!session || session.profile.status !== "active") {
    return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });
  }
  if (session.profile.role !== "admin") {
    return NextResponse.json({ error: { message: "Admin access required." } }, { status: 403 });
  }

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
  if (role !== "admin" && role !== "officer") {
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
    return NextResponse.json(
      { error: { message: createError?.message ?? "Couldn't create this account." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ role, status: "active", must_change_password: mustChangePassword })
    .eq("id", created.user.id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
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
