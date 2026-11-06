begin;

create or replace function public.pf_admin_sync_overview()
returns table(relation_name text, is_present boolean, row_count bigint)
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_name text;
  v_count bigint;
  v_tables text[] := array[
    'pixelforge_admins','catalogo_publico','propuestas_videojuegos',
    'pf_v9_creator_applications','pf_v9_stream_requests','pf_v9_featured_streams','pf_v9_reports',
    'pf_v10_collaborators','pf_v10_advice_requests','pf_v10_polls','pf_v10_poll_votes',
    'pf_rbac_roles','pf_rbac_permissions','pf_rbac_role_permissions','pf_rbac_user_roles','pf_rbac_audit'
  ];
begin
  if auth.uid() is null or not public.pixelforge_es_admin() then
    raise exception 'Solo la superadministración puede consultar el inventario de Supabase.';
  end if;
  foreach v_name in array v_tables loop
    relation_name := v_name;
    if to_regclass(format('public.%I', v_name)) is null then
      is_present := false;
      row_count := 0;
    else
      is_present := true;
      execute format('select count(*) from public.%I', v_name) into v_count;
      row_count := v_count;
    end if;
    return next;
  end loop;
end;
$$;

revoke all on function public.pf_admin_sync_overview() from public;
grant execute on function public.pf_admin_sync_overview() to authenticated;

notify pgrst, 'reload schema';
commit;
