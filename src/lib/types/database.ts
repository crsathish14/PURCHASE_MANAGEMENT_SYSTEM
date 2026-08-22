// Hand-written stub covering only what exists so far. Replace with the real
// generated types once the project is linked to Supabase:
//   npx supabase gen types typescript --linked > src/lib/types/database.ts

import type { ProfileStatus, UserRole } from "@/lib/constants/profile";

export type { ProfileStatus, UserRole };

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
          must_change_password: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          status?: ProfileStatus;
          must_change_password?: boolean;
        };
        Update: {
          full_name?: string | null;
          email?: string | null;
          role?: UserRole;
          status?: ProfileStatus;
          must_change_password?: boolean;
        };
        Relationships: [];
      };
      pr_dropdown_fields: {
        Row: {
          id: string;
          key: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          key?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      pr_dropdown_field_options: {
        Row: {
          id: string;
          field_id: string;
          value: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          field_id: string;
          value: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          field_id?: string;
          value?: string;
          label?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pr_dropdown_field_options_field_id_fkey";
            columns: ["field_id"];
            isOneToOne: false;
            referencedRelation: "pr_dropdown_fields";
            referencedColumns: ["id"];
          },
        ];
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
