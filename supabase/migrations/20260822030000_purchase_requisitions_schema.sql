-- Full lifecycle defined now (not just pending_rfq), matching how profile_status
-- was fully defined before its admin approve/suspend UI existed — the design
-- doc already hands us all 4 values and their chip-tone mapping, so there's
-- no risk of guessing wrong, and it avoids an ALTER TYPE ADD VALUE migration
-- later just to unblock RFQ-issuance work.
create type public.pr_priority as enum ('high', 'medium', 'low');
create type public.pr_status as enum ('pending_rfq', 'rfq_issued', 'quotes_received', 'awarded');

create sequence public.purchase_requisition_pr_number_seq start with 1;

create table public.purchase_requisitions (
  id uuid primary key default gen_random_uuid(),
  pr_number text not null unique default ('PR-' || nextval('public.purchase_requisition_pr_number_seq')),
  priority public.pr_priority not null,
  status public.pr_status not null default 'pending_rfq',
  requested_by date,
  required_port text,
  remarks text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_purchase_requisitions_updated_at
before update on public.purchase_requisitions
for each row execute function public.set_updated_at();

create index purchase_requisitions_created_by_idx on public.purchase_requisitions (created_by);
create index purchase_requisitions_created_at_idx on public.purchase_requisitions (created_at desc);

-- Dropdown selections (vessel/department/category) are a generic child table,
-- NOT fixed columns — pr_dropdown_fields exists specifically so a new field
-- is a data insert, not a code change; hardcoding today's 3 keys here would
-- immediately break that property the moment a 4th field is seeded.
create table public.purchase_requisition_dropdown_values (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  field_id uuid not null references public.pr_dropdown_fields (id) on delete restrict,
  option_value text not null,
  created_at timestamptz not null default now(),
  unique (requisition_id, field_id),
  foreign key (field_id, option_value) references public.pr_dropdown_field_options (field_id, value)
);
create index purchase_requisition_dropdown_values_requisition_id_idx
  on public.purchase_requisition_dropdown_values (requisition_id);

-- Per-PR-unique custom fields ("Add more") — plain 1:N normalization.
create table public.purchase_requisition_custom_fields (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  label text not null,
  value text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index purchase_requisition_custom_fields_requisition_id_idx
  on public.purchase_requisition_custom_fields (requisition_id);

-- Line items + their per-PR-unique extra columns: two axes of dynamism (which
-- columns exist varies per PR; each row's value per column varies per row),
-- modeled the same way pr_dropdown_fields/_options already models
-- "definitions" vs "values" in this codebase, just scoped per-PR instead of
-- global. A `line_items.extra jsonb` column was rejected — that loses the FK
-- guarantee that a value's column_id is a real column definition for that PR,
-- and reintroduces an unbounded-blob shape.
create table public.purchase_requisition_line_items (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  description text not null default '',
  qty text not null default '',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index purchase_requisition_line_items_requisition_id_idx
  on public.purchase_requisition_line_items (requisition_id);

create table public.purchase_requisition_line_item_columns (
  id uuid primary key default gen_random_uuid(),
  requisition_id uuid not null references public.purchase_requisitions (id) on delete cascade,
  label text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index purchase_requisition_line_item_columns_requisition_id_idx
  on public.purchase_requisition_line_item_columns (requisition_id);

create table public.purchase_requisition_line_item_values (
  id uuid primary key default gen_random_uuid(),
  line_item_id uuid not null references public.purchase_requisition_line_items (id) on delete cascade,
  column_id uuid not null references public.purchase_requisition_line_item_columns (id) on delete cascade,
  value text not null default '',
  unique (line_item_id, column_id)
);
create index purchase_requisition_line_item_values_line_item_id_idx
  on public.purchase_requisition_line_item_values (line_item_id);
create index purchase_requisition_line_item_values_column_id_idx
  on public.purchase_requisition_line_item_values (column_id);
