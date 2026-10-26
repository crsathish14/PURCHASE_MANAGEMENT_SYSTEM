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
          master_owners: string;
          company_name: string;
          address: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          imo_no: string;
          master_owners?: string;
          company_name?: string;
          address?: string;
        };
        Update: {
          name?: string;
          imo_no?: string;
          master_owners?: string;
          company_name?: string;
          address?: string;
        };
        Relationships: [];
      };
      vendors: {
        Row: {
          id: string;
          name: string;
          pic: string;
          address: string;
          mail: string[];
          contact: string[];
          gst: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          pic?: string;
          address?: string;
          mail?: string[];
          contact?: string[];
          gst?: string;
          created_at?: string;
        };
        Update: {
          name?: string;
          pic?: string;
          address?: string;
          mail?: string[];
          contact?: string[];
          gst?: string;
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
          awarded_rfq_link_id: string | null;
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
          awarded_rfq_link_id?: string | null;
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
          awarded_rfq_link_id?: string | null;
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
          vendor_id: string | null;
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
          vendor_id?: string | null;
          vendor_name: string;
          vendor_email: string;
          access_token: string;
          message: string;
          expires_at: string;
          submitted_at?: string | null;
          created_by: string;
        };
        Update: {
          vendor_id?: string | null;
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
          {
            foreignKeyName: "purchase_requisition_rfq_links_vendor_id_fkey";
            columns: ["vendor_id"];
            isOneToOne: false;
            referencedRelation: "vendors";
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
          requested_part_no: string | null;
          approved_qty: number | null;
          uom: string | null;
          offered_description: string | null;
          offered_impa_code: string | null;
          offered_part_no: string | null;
          item_type: string | null;
          unit_price: number | null;
          total_price: number | null;
          delivery_lead_time: string | null;
          remarks: string | null;
          estimated_duration: string | null;
          spares_consumables_included: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          quotation_id: string;
          line_item_id: string;
          requested_description: string;
          requested_impa_code?: string | null;
          requested_part_no?: string | null;
          approved_qty?: number | null;
          uom?: string | null;
          offered_description?: string | null;
          offered_impa_code?: string | null;
          offered_part_no?: string | null;
          item_type?: string | null;
          unit_price?: number | null;
          total_price?: number | null;
          delivery_lead_time?: string | null;
          remarks?: string | null;
          estimated_duration?: string | null;
          spares_consumables_included?: string | null;
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
      purchase_order_drafts: {
        Row: {
          id: string;
          requisition_id: string;
          quotation_id: string;
          same_as_quote_qty: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          quotation_id: string;
          same_as_quote_qty?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          quotation_id?: string;
          same_as_quote_qty?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_drafts_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: true;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_drafts_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: true;
            referencedRelation: "purchase_requisition_rfq_quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_draft_items: {
        Row: {
          id: string;
          draft_id: string;
          quotation_item_id: string;
          needed_po_qty: number;
        };
        Insert: {
          id?: string;
          draft_id: string;
          quotation_item_id: string;
          needed_po_qty: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "purchase_order_draft_items_draft_id_fkey";
            columns: ["draft_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_drafts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_draft_items_quotation_item_id_fkey";
            columns: ["quotation_item_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_rfq_quotation_items";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_issuances: {
        Row: {
          id: string;
          requisition_id: string;
          quotation_id: string;
          access_token: string;
          vendor_name: string;
          vendor_email: string;
          message: string;
          invoice_to_company_name: string;
          invoice_to_address: string;
          issued_at: string;
          proforma_invoice_path: string | null;
          proforma_invoice_file_name: string | null;
          proforma_received_at: string | null;
        };
        Insert: {
          id?: string;
          requisition_id: string;
          quotation_id: string;
          access_token?: string;
          vendor_name: string;
          vendor_email: string;
          message: string;
          invoice_to_company_name?: string;
          invoice_to_address?: string;
          issued_at?: string;
          proforma_invoice_path?: string | null;
          proforma_invoice_file_name?: string | null;
          proforma_received_at?: string | null;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "purchase_order_issuances_requisition_id_fkey";
            columns: ["requisition_id"];
            isOneToOne: true;
            referencedRelation: "purchase_requisitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_issuances_quotation_id_fkey";
            columns: ["quotation_id"];
            isOneToOne: false;
            referencedRelation: "purchase_requisition_rfq_quotations";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_issuance_items: {
        Row: {
          id: string;
          issuance_id: string;
          description: string;
          part_no: string | null;
          uom: string | null;
          quantity: number | null;
          unit_price: number | null;
          total_price: number;
          sort_order: number;
        };
        Insert: {
          id?: string;
          issuance_id: string;
          description: string;
          part_no?: string | null;
          uom?: string | null;
          quantity?: number | null;
          unit_price?: number | null;
          total_price: number;
          sort_order?: number;
        };
        Update: never;
        Relationships: [
          {
            foreignKeyName: "purchase_order_issuance_items_issuance_id_fkey";
            columns: ["issuance_id"];
            isOneToOne: false;
            referencedRelation: "purchase_order_issuances";
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
          pr_title: string | null;
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
        Args: {
          p_name: string;
          p_imo_no: string;
          p_master_owners: string;
          p_company_name: string;
          p_address: string;
        };
        Returns: {
          id: string;
          name: string;
          imo_no: string;
          master_owners: string;
          company_name: string;
          address: string;
          created_at: string;
        }[];
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
      award_purchase_requisition: {
        Args: { p_id: string; p_rfq_link_id: string };
        Returns: { id: string; status: PrStatus; awarded_rfq_link_id: string }[];
      };
      save_purchase_order_draft: {
        Args: { p_requisition_id: string; p_items: Json; p_same_as_quote_qty: boolean };
        Returns: string;
      };
      issue_purchase_order: {
        Args: {
          p_requisition_id: string;
          p_items: Json;
          p_same_as_quote_qty: boolean;
          p_message: string;
          p_invoice_to_company_name: string;
          p_invoice_to_address: string;
        };
        Returns: string;
      };
      get_purchase_order_issue_token: {
        Args: { p_requisition_id: string };
        Returns: string;
      };
      submit_purchase_order_proforma: {
        Args: { p_token: string; p_storage_path: string; p_file_name: string };
        Returns: boolean;
      };
      get_purchase_order_by_token: {
        Args: { p_token: string };
        Returns: {
          requisition_id: string;
          pr_number: string;
          vessel_label: string | null;
          category: string | null;
          vendor_name: string;
          vendor_email: string;
          message: string;
          issued_at: string;
          items: Json;
        }[];
      };
      get_purchase_order_for_export: {
        Args: { p_requisition_id: string };
        Returns: {
          requisition_id: string;
          vendor_name: string;
          vendor_email: string;
          invoice_to_company_name: string;
          invoice_to_address: string;
          issued_at: string;
          items: Json;
        }[];
      };
      get_purchase_order_pdf_by_token: {
        Args: { p_token: string };
        Returns: {
          requisition_id: string;
          pr_number: string;
          requisition_title: string | null;
          category: string;
          vessel_name: string | null;
          vessel_imo_no: string | null;
          vessel_master_owners: string | null;
          issued_vendor_name: string;
          issued_vendor_email: string;
          vendor_contact_person: string | null;
          quotation_no: string | null;
          ref_no: string | null;
          payment_terms: string;
          invoice_to_company_name: string;
          invoice_to_address: string;
          issued_at: string;
          items: Json;
        }[];
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
          pr_title: string | null;
          total_count: number;
        }[];
      };
      issue_rfq_link: {
        Args: {
          p_requisition_id: string;
          p_vendor_id: string;
          p_vendor_email: string;
          p_expires_at: string;
          p_message: string;
        };
        Returns: { id: string; access_token: string }[];
      };
      reissue_rfq_link: {
        Args: {
          p_link_id: string;
          p_vendor_id: string;
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
          equipment_name: string | null;
          equipment_type: string | null;
          equipment_make: string | null;
          equipment_serial_no: string | null;
          equipment_model: string | null;
          equipment_specifications: string | null;
          equipment_other_details: string | null;
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
          pr_title: string | null;
          vessel_label: string | null;
          category_label: string | null;
          vendor_count: number;
          quote_count: number;
          derived_status: string;
          first_issued_at: string;
          total_count: number;
        }[];
      };
      search_purchase_orders: {
        Args: {
          p_search: string | null;
          p_statuses: string[] | null;
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
          pr_title: string | null;
          vessel_label: string | null;
          vendor_name: string;
          quote_reference: string | null;
          total_quoted_amount: number;
          quote_submitted_at: string;
          status: string;
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
