// Single source of truth for purchase_requisitions.priority/status values —
// never compare against the raw "high"/"pending_rfq"/etc. string literals
// directly, import these instead so a typo is a type error, not a silent no-op.
export const PR_PRIORITY = { HIGH: "high", MEDIUM: "medium", LOW: "low" } as const;
export const PR_STATUS = {
  PENDING_RFQ: "pending_rfq",
  RFQ_ISSUED: "rfq_issued",
  QUOTES_RECEIVED: "quotes_received",
  AWARDED: "awarded",
  CANCELLED: "cancelled",
} as const;

export const DATE_PRESET = {
  LAST_1_MONTH: "last_1_month",
  LAST_3_MONTHS: "last_3_months",
  LAST_6_MONTHS: "last_6_months",
  CUSTOM: "custom",
} as const;

// Frontend-only branching aid for the `category` dropdown field's concrete
// values — this does NOT replace pr_dropdown_fields/pr_dropdown_field_options
// as the source of truth for the dropdown's actual label/option list (still
// DB-driven via getPrDropdownFields()); it exists only so line-items-field.tsx
// and buildCreateRequisitionSchema can branch on "is this Service vs
// Stores/Spares" without a raw string literal. Values must match the seeded
// pr_dropdown_field_options.value rows (see the dropdown cleanup migration).
export const PR_CATEGORY = { SERVICE: "service", STORES: "stores", SPARES: "spares" } as const;

// Stable, well-known keys for the category-driven preset line-item columns —
// deliberately NOT crypto.randomUUID() like a genuinely user-added "+ Add
// column" entry, so line-items-field.tsx can precisely add/remove exactly
// these without touching a real custom column. APPROVED_QTY/REMARKS/UOM
// apply to both Stores and Spares; PART_NO is Spares-only and IMPA_CODE is
// Stores-only (Spares has no IMPA/ISSA code equivalent) — see the
// category -> preset-set lookup in line-items-field.tsx.
export const PR_LINE_ITEM_PRESET_COLUMN = {
  APPROVED_QTY: "approved_qty",
  REMARKS: "remarks",
  PART_NO: "part_no",
  IMPA_CODE: "impa_code",
  UOM: "uom",
  ROB: "rob",
} as const;

export type PrPriority = (typeof PR_PRIORITY)[keyof typeof PR_PRIORITY];
export type PrStatus = (typeof PR_STATUS)[keyof typeof PR_STATUS];
export type DatePreset = (typeof DATE_PRESET)[keyof typeof DATE_PRESET];
export type PrCategory = (typeof PR_CATEGORY)[keyof typeof PR_CATEGORY];
