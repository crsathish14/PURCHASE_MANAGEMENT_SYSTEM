import type { ProfileStatus, UserRole } from "@/lib/types/database";

export const SELECT_COLUMNS = "id, full_name, email, role, status, created_at";

export function toTeamMember(row: {
  id: string;
  full_name: string | null;
  email: string | null;
  role: UserRole;
  status: ProfileStatus;
  created_at: string;
}) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  };
}
