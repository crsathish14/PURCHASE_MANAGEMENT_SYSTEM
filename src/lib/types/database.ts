// Hand-written stub covering only what exists so far. Replace with the real
// generated types once the project is linked to Supabase:
//   npx supabase gen types typescript --linked > src/lib/types/database.ts

import type { ProfileStatus, UserRole } from "@/lib/constants/profile";
import type { PrPriority, PrStatus } from "@/lib/constants/purchase-requisition";

export type { ProfileStatus, UserRole };
export type { PrPriority, PrStatus };

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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
      purchase_requisitions: {
        Row: {
          id: string;
          pr_number: string;
          priority: PrPriority;
          status: PrStatus;
          requested_by: string | null;
          required_port: string | null;
          remarks: string | null;
          requisition_number: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pr_number?: string;
          priority: PrPriority;
          status?: PrStatus;
          requested_by?: string | null;
          required_port?: string | null;
          remarks?: string | null;
          requisition_number?: string | null;
          created_by: string;
        };
        Update: {
          priority?: PrPriority;
          status?: PrStatus;
          requested_by?: string | null;
          required_port?: string | null;
          remarks?: string | null;
          requisition_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisitions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_dropdown_values: {
        Row: {
          id: string;
          requisition_id: string;
          field_id: string;
          option_value: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          field_id: string;
          option_value: string;
        };
        Update: {
          requisition_id?: string;
          field_id?: string;
          option_value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_dropdown_values_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requisition_dropdown_values_field_id_fkey";
            columns: ["field_id"];
            isOneToOne: false;
            referencedRelation: "pr_dropdown_fields";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_custom_fields: {
        Row: {
          id: string;
          requisition_id: string;
          label: string;
          value: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          label: string;
          value?: string;
          sort_order?: number;
        };
        Update: {
          label?: string;
          value?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_custom_fields_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_line_items: {
        Row: {
          id: string;
          requisition_id: string;
          description: string;
          qty: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          description?: string;
          qty?: string;
          sort_order?: number;
        };
        Update: {
          description?: string;
          qty?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_line_items_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_line_item_columns: {
        Row: {
          id: string;
          requisition_id: string;
          label: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          label: string;
          sort_order?: number;
        };
        Update: {
          label?: string;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_line_item_columns_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_line_item_values: {
        Row: {
          id: string;
          line_item_id: string;
          column_id: string;
          value: string;
        };
        Insert: {
          id?: string;
          line_item_id: string;
          column_id: string;
          value?: string;
        };
        Update: {
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_line_item_values_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_line_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requisition_line_item_values_column_id_fkey";
            columns: ["column_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_line_item_columns";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_line_item_attachments: {
        Row: {
          id: string;
          line_item_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          line_item_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          sort_order?: number;
        };
        Update: {
          storage_path?: string;
          file_name?: string;
          content_type?: string;
          size_bytes?: number;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_line_item_attachments_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_line_items";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      pr_requisition_list: {
        Row: {
          id: string;
          pr_number: string;
          priority: PrPriority;
          status: PrStatus;
          created_at: string;
          vessel_label: string | null;
          department_label: string | null;
          category_label: string | null;
          item_count: number;
          requester_name: string | null;
          remarks: string | null;
          vessel_value: string | null;
          category_value: string | null;
          requisition_number: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      create_purchase_requisition: {
        Args: {
          p_priority: PrPriority;
          p_requested_by: string | null;
          p_required_port: string | null;
          p_remarks: string | null;
          p_requisition_number: string | null;
          p_dropdowns: Json;
          p_custom_fields: Json;
          p_columns: Json;
          p_line_items: Json;
        };
        Returns: { id: string; pr_number: string }[];
      };
      update_purchase_requisition: {
        Args: {
          p_id: string;
          p_priority: PrPriority;
          p_requested_by: string | null;
          p_required_port: string | null;
          p_remarks: string | null;
          p_requisition_number: string | null;
          p_dropdowns: Json;
          p_custom_fields: Json;
          p_columns: Json;
          p_line_items: Json;
        };
        Returns: { id: string; pr_number: string }[];
      };
      cancel_purchase_requisition: {
        Args: { p_id: string };
        Returns: { id: string; status: PrStatus }[];
      };
      duplicate_purchase_requisition: {
        Args: { p_id: string };
        Returns: { id: string; pr_number: string }[];
      };
      delete_purchase_requisition: {
        Args: { p_id: string };
        Returns: { id: string }[];
      };
      search_purchase_requisitions: {
        Args: {
          p_search: string | null;
          p_statuses: PrStatus[] | null;
          p_vessels: string[] | null;
          p_categories: string[] | null;
          p_date_preset: string | null;
          p_start_date: string | null;
          p_end_date: string | null;
          p_page: number;
          p_page_size: number;
        };
        Returns: {
          id: string;
          pr_number: string;
          priority: PrPriority;
          status: PrStatus;
          created_at: string;
          vessel_label: string | null;
          department_label: string | null;
          category_label: string | null;
          item_count: number;
          requester_name: string | null;
          requisition_number: string | null;
          total_count: number;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      profile_status: ProfileStatus;
      pr_priority: PrPriority;
      pr_status: PrStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
