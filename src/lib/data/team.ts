import { createClient } from "@/lib/supabase/server";
import type { ProfileStatus, UserRole } from "@/lib/types/database";

export type TeamMember = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: UserRole;
  status: ProfileStatus;
  createdAt: string;
};

// Relies on RLS (profiles_select_admin_all) as defense-in-depth: an
// authenticated caller only sees every row here if they're an admin, so
// this is safe to call as soon as the caller has been through
// requireAdmin()/getSessionProfile()'s admin check, not before.
export async function getTeamMembers(): Promise<TeamMember[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }));
}
