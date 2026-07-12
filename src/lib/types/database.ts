// Hand-written stub covering only what exists so far. Replace with the real
// generated types once the project is linked to Supabase:
//   npx supabase gen types typescript --linked > src/lib/types/database.ts

export type UserRole = "admin" | "officer";
export type ProfileStatus = "pending" | "active" | "disabled";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          role: UserRole;
          status: ProfileStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          status?: ProfileStatus;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          status?: ProfileStatus;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      user_role: UserRole;
      profile_status: ProfileStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
