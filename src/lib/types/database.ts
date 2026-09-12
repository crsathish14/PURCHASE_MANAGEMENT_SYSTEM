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
      vessels: {
        Row: {
          id: string;
          name: string;
          imo_no: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          imo_no: string;
        };
        Update: {
          name?: string;
          imo_no?: string;
        };
        Relationships: [];
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
          requisition_date: string | null;
          title: string | null;
          equipment_name: string | null;
          equipment_type: string | null;
          equipment_make: string | null;
          equipment_serial_no: string | null;
          equipment_model: string | null;
          equipment_specifications: string | null;
          equipment_other_details: string | null;
          requisitioned_by: string | null;
          captain_chief_engineer: string | null;
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
          requisition_date?: string | null;
          title?: string | null;
          equipment_name?: string | null;
          equipment_type?: string | null;
          equipment_make?: string | null;
          equipment_serial_no?: string | null;
          equipment_model?: string | null;
          equipment_specifications?: string | null;
          equipment_other_details?: string | null;
          requisitioned_by?: string | null;
          captain_chief_engineer?: string | null;
          created_by: string;
        };
        Update: {
          priority?: PrPriority;
          status?: PrStatus;
          requested_by?: string | null;
          required_port?: string | null;
          remarks?: string | null;
          requisition_number?: string | null;
          requisition_date?: string | null;
          title?: string | null;
          equipment_name?: string | null;
          equipment_type?: string | null;
          equipment_make?: string | null;
          equipment_serial_no?: string | null;
          equipment_model?: string | null;
          equipment_specifications?: string | null;
          equipment_other_details?: string | null;
          requisitioned_by?: string | null;
          captain_chief_engineer?: string | null;
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
      purchase_requisition_rfq_links: {
        Row: {
          id: string;
          requisition_id: string;
          vendor_name: string;
          vendor_email: string;
          access_token: string;
          message: string;
          expires_at: string;
          submitted_at: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          vendor_name: string;
          vendor_email: string;
          access_token: string;
          message: string;
          expires_at: string;
          submitted_at?: string | null;
          created_by: string;
        };
        Update: {
          vendor_name?: string;
          vendor_email?: string;
          message?: string;
          expires_at?: string;
          submitted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_rfq_links_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requisition_rfq_links_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_rfq_quotations: {
        Row: {
          id: string;
          rfq_link_id: string;
          requisition_id: string;
          quotation_no: string | null;
          ref_no: string | null;
          vendor_name: string;
          vendor_contact_person: string | null;
          vendor_contact_no: string | null;
          vendor_email: string | null;
          vendor_other_details: string | null;
          currency: string;
          total_quoted_amount: number;
          quotation_validity: string;
          payment_terms: string;
          delivery_terms: string;
          remarks_notes: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          rfq_link_id: string;
          requisition_id: string;
          quotation_no?: string | null;
          ref_no?: string | null;
          vendor_name: string;
          vendor_contact_person?: string | null;
          vendor_contact_no?: string | null;
          vendor_email?: string | null;
          vendor_other_details?: string | null;
          currency?: string;
          total_quoted_amount?: number;
          quotation_validity: string;
          payment_terms: string;
          delivery_terms: string;
          remarks_notes: string;
        };
        Update: {
          total_quoted_amount?: number;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_rfq_quotations_rfq_link_id_fkey";
            columns: ["rfq_link_id"];
            isOneToOne: true;
            referencedRelation: "purchase_requisition_rfq_links";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requisition_rfq_quotations_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_rfq_quotation_items: {
        Row: {
          id: string;
          quotation_id: string;
          line_item_id: string;
          requested_description: string;
          requested_impa_code: string | null;
          approved_qty: number | null;
          uom: string | null;
          offered_description: string | null;
          offered_impa_code: string | null;
          unit_price: number | null;
          total_price: number | null;
          delivery_lead_time: string | null;
          remarks: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          line_item_id: string;
          requested_description: string;
          requested_impa_code?: string | null;
          approved_qty?: number | null;
          uom?: string | null;
          offered_description?: string | null;
          offered_impa_code?: string | null;
          unit_price?: number | null;
          total_price?: number | null;
          delivery_lead_time?: string | null;
          remarks?: string | null;
          sort_order?: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_rfq_quotation_items_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_rfq_quotations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_requisition_rfq_quotation_items_line_item_id_fkey";
            columns: ["line_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_line_items";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_requisition_rfq_quotation_item_photos: {
        Row: {
          id: string;
          quotation_item_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quotation_item_id: string;
          storage_path: string;
          file_name: string;
          content_type: string;
          size_bytes: number;
          sort_order?: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "purchase_requisition_rfq_quotation_item_photos_quotation_item_id_fkey";
            columns: ["quotation_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_rfq_quotation_items";
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
      pr_rfq_progress: {
        Row: {
          requisition_id: string;
          vendor_count: number;
          first_issued_at: string;
          quote_count: number;
          derived_status: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      add_vessel: {
        Args: { p_name: string; p_imo_no: string };
        Returns: { id: string; name: string; imo_no: string; created_at: string }[];
      };
      create_purchase_requisition: {
        Args: {
          p_priority: PrPriority;
          p_requested_by: string | null;
          p_required_port: string | null;
          p_remarks: string | null;
          p_requisition_number: string | null;
          p_requisition_date: string | null;
          p_title: string | null;
          p_equipment_name: string | null;
          p_equipment_type: string | null;
          p_equipment_make: string | null;
          p_equipment_serial_no: string | null;
          p_equipment_model: string | null;
          p_equipment_specifications: string | null;
          p_equipment_other_details: string | null;
          p_requisitioned_by: string | null;
          p_captain_chief_engineer: string | null;
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
          p_requisition_date: string | null;
          p_title: string | null;
          p_equipment_name: string | null;
          p_equipment_type: string | null;
          p_equipment_make: string | null;
          p_equipment_serial_no: string | null;
          p_equipment_model: string | null;
          p_equipment_specifications: string | null;
          p_equipment_other_details: string | null;
          p_requisitioned_by: string | null;
          p_captain_chief_engineer: string | null;
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
        Returns: { id: string; pr_number: string; line_item_id_map: Json }[];
      };
      duplicate_purchase_requisition_line_item_attachments: {
        Args: { p_attachments: Json };
        Returns: undefined;
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
      issue_rfq_link: {
        Args: {
          p_requisition_id: string;
          p_vendor_name: string;
          p_vendor_email: string;
          p_expires_at: string;
          p_message: string;
        };
        Returns: { id: string; access_token: string }[];
      };
      reissue_rfq_link: {
        Args: {
          p_link_id: string;
          p_vendor_name: string;
          p_vendor_email: string;
          p_expires_at: string;
          p_message: string;
        };
        Returns: { id: string; access_token: string }[];
      };
      get_rfq_link_by_token: {
        Args: { p_token: string };
        Returns: {
          requisition_id: string;
          pr_number: string;
          vendor_name: string;
          expires_at: string;
          submitted_at: string | null;
          is_expired: boolean;
        }[];
      };
      submit_rfq_link: {
        Args: { p_token: string };
        Returns: { success: boolean }[];
      };
      get_rfq_quote_details_by_token: {
        Args: { p_token: string };
        Returns: {
          requisition_id: string;
          pr_number: string;
          vendor_name: string;
          vendor_email: string;
          expires_at: string;
          submitted_at: string | null;
          is_expired: boolean;
          category: string | null;
          requisition_date: string | null;
          requested_by: string | null;
          required_port: string | null;
          vessel_label: string | null;
          vessel_imo_no: string | null;
          line_items: Json;
        }[];
      };
      submit_rfq_quotation: {
        Args: {
          p_token: string;
          p_quotation_no: string | null;
          p_ref_no: string | null;
          p_vendor_name: string;
          p_vendor_contact_person: string | null;
          p_vendor_contact_no: string | null;
          p_vendor_email: string | null;
          p_vendor_other_details: string | null;
          p_quotation_validity: string;
          p_payment_terms: string;
          p_delivery_terms: string;
          p_remarks_notes: string;
          p_items: Json;
        };
        Returns: { success: boolean }[];
      };
      search_requested_quotes: {
        Args: {
          p_search: string | null;
          p_derived_statuses: string[] | null;
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
          requisition_number: string | null;
          vessel_label: string | null;
          vendor_count: number;
          quote_count: number;
          derived_status: string;
          first_issued_at: string;
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
