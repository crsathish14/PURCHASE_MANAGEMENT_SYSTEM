-- Dedicated vessel master-data table for the Settings > Vessel tab (list +
-- add only, no edit/delete). Distinct from pr_dropdown_field_options (which
-- only has value/label and backs the generic Create Requisition dropdowns)
-- because this table needs a unique IMO No the generic table has no room for.
create table public.vessels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  imo_no text not null,
  created_at timestamptz not null default now(),
  constraint vessels_name_unique unique (name),
  constraint vessels_imo_no_unique unique (imo_no)
);

alter table public.vessels enable row level security;

-- Same "any active user, app layer is the real gate" trust model as
-- pr_dropdown_fields/pr_dropdown_field_options and the purchase_requisition_*
-- tables — requireApiAdmin() in src/app/api/vessels/route.ts is what actually
-- restricts adding a vessel to admins; select is open to any authenticated
-- user since the Create Requisition dropdown needs to read it too.
create policy "vessels_select_authenticated"
on public.vessels for select
to authenticated
using (true);

create policy "vessels_insert_authenticated"
on public.vessels for insert
to authenticated
with check (true);

-- Adding a vessel must also add a matching option to the existing generic
-- pr_dropdown_field_options table (field key 'vessel') so the Create
-- Requisition dropdown, its Zod validation, and the PR search/filter RPC —
-- none of which this feature touches — pick up the new vessel automatically.
-- Doing both inserts inside one function keeps them atomic instead of two
-- separate round trips from the API route. security definer because
-- pr_dropdown_field_options intentionally has no insert policy of its own
-- (see 20260822010000_pr_dropdown_fields.sql) — this function is the one
-- narrow, validated path allowed to add to it; search_path is pinned so it
-- can't be hijacked by a caller-controlled search_path.
create function public.add_vessel(p_name text, p_imo_no text)
returns table (id uuid, name text, imo_no text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_created_at timestamptz;
  v_field_id uuid;
  v_base_slug text;
  v_slug text;
  v_suffix int := 1;
begin
  insert into public.vessels (name, imo_no)
  values (p_name, p_imo_no)
  returning vessels.id, vessels.created_at into v_id, v_created_at;

  select pr_dropdown_fields.id into v_field_id
  from public.pr_dropdown_fields
  where key = 'vessel';

  v_base_slug := lower(regexp_replace(trim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_slug := v_base_slug;
  while exists (
    select 1 from public.pr_dropdown_field_options
    where field_id = v_field_id and value = v_slug
  ) loop
    v_suffix := v_suffix + 1;
    v_slug := v_base_slug || '-' || v_suffix;
  end loop;

  insert into public.pr_dropdown_field_options (field_id, value, label, sort_order)
  select v_field_id, v_slug, p_name, coalesce(max(sort_order), -1) + 1
  from public.pr_dropdown_field_options
  where field_id = v_field_id;

  return query select v_id, p_name, p_imo_no, v_created_at;
end;
$$;

revoke all on function public.add_vessel(text, text) from public;
grant execute on function public.add_vessel(text, text) to authenticated;
