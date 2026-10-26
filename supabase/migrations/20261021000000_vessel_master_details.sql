-- Store vessel ownership, company, and address details alongside the existing
-- master data. Defaults keep already-saved vessels readable until details are
-- filled in from the Vessels settings page.
alter table public.vessels
  add column master_owners text not null default '',
  add column company_name text not null default '',
  add column address text not null default '';

-- Keep direct table updates admin-only as well as protecting the API route.
create policy "vessels_update_admin"
on public.vessels for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Replace the original add function so inserting the new fields and mirroring
-- the vessel into the requisition dropdown still happen atomically.
drop function public.add_vessel(text, text);

create function public.add_vessel(
  p_name text,
  p_imo_no text,
  p_master_owners text,
  p_company_name text,
  p_address text
)
returns table (
  id uuid,
  name text,
  imo_no text,
  master_owners text,
  company_name text,
  address text,
  created_at timestamptz
)
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
  insert into public.vessels (name, imo_no, master_owners, company_name, address)
  values (p_name, p_imo_no, p_master_owners, p_company_name, p_address)
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

  return query
  select v_id, p_name, p_imo_no, p_master_owners, p_company_name, p_address, v_created_at;
end;
$$;

revoke all on function public.add_vessel(text, text, text, text, text) from public;
grant execute on function public.add_vessel(text, text, text, text, text) to authenticated;
