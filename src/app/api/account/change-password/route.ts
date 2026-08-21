import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/supabase/require-active-user";

// Used both by the forced first-login reset (must_change_password) and any
// future voluntary "change password" entry point — nothing here is specific
// to the forced case. Re-verifies the current password via signInWithPassword
// before allowing the change, since this is reachable without re-entering a
// fresh login flow.
export async function POST(request: Request) {
  const session = await getSessionProfile();

  if (!session || session.profile.status !== "active") {
    return NextResponse.json({ error: { message: "Authentication required." } }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const { email, currentPassword, newPassword, confirmNewPassword } = (body ?? {}) as {
    email?: unknown;
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmNewPassword?: unknown;
  };

  if (typeof email !== "string" || email.trim().length === 0) {
    return NextResponse.json({ error: { message: "Email is required." } }, { status: 400 });
  }
  if (email !== session.user.email) {
    return NextResponse.json(
      { error: { message: "That email doesn't match your account." } },
      { status: 400 },
    );
  }
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return NextResponse.json(
      { error: { message: "Enter your current password." } },
      { status: 400 },
    );
  }
  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json(
      { error: { message: "Password must be at least 8 characters." } },
      { status: 400 },
    );
  }
  if (newPassword !== confirmNewPassword) {
    return NextResponse.json({ error: { message: "Passwords don't match." } }, { status: 400 });
  }

  const supabase = await createClient();

  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (verifyError) {
    return NextResponse.json(
      { error: { message: "Current password is incorrect." } },
      { status: 400 },
    );
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    return NextResponse.json({ error: { message: updateError.message } }, { status: 400 });
  }

  // No self-update RLS policy exists for profiles (see the migration
  // comment) — this one narrow write goes through the service-role client.
  await createAdminClient()
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", session.user.id);

  return NextResponse.json({ data: { ok: true } });
}
