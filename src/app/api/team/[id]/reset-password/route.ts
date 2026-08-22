import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { SELECT_COLUMNS, toTeamMember } from "../../shared";

// Admin-only: resets a team member's password via the Supabase Admin API.
// Role is never touched here — that's still the separate PATCH .../[id]
// role mutation exposed via the row menu's Make admin/officer item.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json(
      { error: { message: "Use Change password to update your own password." } },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const { password, requirePasswordReset } = (body ?? {}) as {
    password?: unknown;
    requirePasswordReset?: unknown;
  };

  if (typeof password !== "string" || password.length < 8) {
    return NextResponse.json(
      { error: { message: "Password must be at least 8 characters." } },
      { status: 400 },
    );
  }
  const mustChangePassword = requirePasswordReset !== false;

  const adminClient = createAdminClient();
  const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(id, { password });

  if (updateAuthError) {
    console.error("[api/team/[id]/reset-password:POST] updateUserById failed", updateAuthError);
    return NextResponse.json(
      { error: { message: updateAuthError.message || "Couldn't reset this person's password." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ must_change_password: mustChangePassword })
    .eq("id", id)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[api/team/[id]/reset-password:POST] profile update failed", error);
    return NextResponse.json(
      {
        error: {
          message:
            "The password was reset but finishing the update didn't complete. Try again, or verify from the table.",
        },
      },
      { status: 500 },
    );
  }

  return NextResponse.json({ data: toTeamMember(data) });
}
