import { NextResponse } from "next/server";

import { getTeamMembers } from "@/lib/data/team";
import { getSessionProfile } from "@/lib/supabase/require-active-user";

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
