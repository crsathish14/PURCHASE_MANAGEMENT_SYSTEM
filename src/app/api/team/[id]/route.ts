import { NextResponse } from "next/server";

import { PROFILE_STATUS, USER_ROLE } from "@/lib/constants/profile";
import { createClient } from "@/lib/supabase/server";
import { requireApiAdmin } from "@/lib/supabase/require-active-user";
import { SELECT_COLUMNS, toTeamMember } from "../shared";

// Admin-only: approve/reject a pending person, suspend/activate an existing
// one, or change an approved person's role. Status covers all four of
// approve/reject/suspend/activate (same "set active or disabled" shape,
// regardless of the row's current status) and role is a separate mutation —
// status/role are mutually exclusive in the body.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const { session } = auth;

  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json(
      { error: { message: "You can't update your own account here." } },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { message: "Invalid request body." } }, { status: 400 });
  }

  const { status, role } = (body ?? {}) as { status?: unknown; role?: unknown };
  const hasStatus = status !== undefined;
  const hasRole = role !== undefined;

  if (hasStatus === hasRole) {
    return NextResponse.json(
      { error: { message: "Provide exactly one of status or role." } },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  if (hasStatus) {
    if (status !== PROFILE_STATUS.ACTIVE && status !== PROFILE_STATUS.DISABLED) {
      return NextResponse.json({ error: { message: "Invalid status." } }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id)
      .neq("status", status) // no-op guard: also catches an already-actioned race
      .select(SELECT_COLUMNS)
      .single();

    if (error || !data) {
      console.error("[api/team/[id]:PATCH] status update failed", error);
      return NextResponse.json(
        { error: { message: "This person's status couldn't be updated." } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: toTeamMember(data) });
  }

  if (role !== USER_ROLE.ADMIN && role !== USER_ROLE.OFFICER) {
    return NextResponse.json({ error: { message: "Invalid role." } }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", id)
    .eq("status", PROFILE_STATUS.ACTIVE)
    .select(SELECT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("[api/team/[id]:PATCH] role update failed", error);
    return NextResponse.json(
      { error: { message: "This person can't be updated." } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: toTeamMember(data) });
}
