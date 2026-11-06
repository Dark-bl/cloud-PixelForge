begin;

create table if not exists public.pf_rbac_roles (
  code text primary key check (code ~ '^[a-z][a-z0-9_]{1,39}$'),
  name text not null,
  description text not null default '',
  assignable boolean not null default true,
  sort_order integer not null default 100
);

create table if not exists public.pf_rbac_permissions (
  code text primary key check (code ~ '^[a-z][a-z0-9_.]{1,79}$'),
  description text not null default ''
);

create table if not exists public.pf_rbac_role_permissions (
  role_code text not null references public.pf_rbac_roles(code) on delete cascade,
  permission_code text not null references public.pf_rbac_permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);

create table if not exists public.pf_rbac_user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_code text not null references public.pf_rbac_roles(code) on delete restrict,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);

create table if not exists public.pf_rbac_audit (
  id bigint generated always as identity primary key,
  target_user_id uuid references auth.users(id) on delete set null,
  role_code text not null,
  action text not null check (action in ('assigned','removed')),
  actor_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

insert into public.pf_rbac_roles(code,name,description,assignable,sort_order) values
('usuario','Usuario','Acceso general a las funciones públicas.',false,10),
('creador','Creador','Puede publicar y administrar sus propias creaciones.',true,20),
('streamer','Streamer','Puede gestionar las funciones autorizadas para streaming.',true,30),
('programador','Programador','Acceso a herramientas y espacios técnicos autorizados.',true,40),
('aficionado','Aficionado a los videojuegos','Participa y apoya a la comunidad gamer.',true,50),
('colaborador','Colaborador','Puede atender solicitudes de asesoría autorizadas.',true,60),
('moderador','Moderador','Puede apoyar en moderación y revisión de reportes.',true,70),
('administrador','Administrador','Rol reservado; no se asigna desde el panel de roles.',false,90),
('superadministrador','Superadministrador','Acceso administrativo raíz gestionado en pixelforge_admins.',false,100)
on conflict (code) do update set name=excluded.name, description=excluded.description, assignable=excluded.assignable, sort_order=excluded.sort_order;

insert into public.pf_rbac_permissions(code,description) values
('profile.read','Consultar el perfil propio.'),
('profile.manage','Editar el perfil propio.'),
('community.read','Consultar la comunidad.'),
('community.help','Participar como apoyo de la comunidad.'),
('content.create','Crear publicaciones o contenido.'),
('content.manage_own','Administrar el contenido propio.'),
('content.moderate','Moderar contenido.'),
('stream.manage_own','Administrar el canal de streaming propio.'),
('developer.tools','Acceder a herramientas técnicas autorizadas.'),
('advice.request','Solicitar asesorías.'),
('advice.give','Atender solicitudes de asesoría.'),
('reports.submit','Enviar reportes.'),
('reports.manage','Gestionar reportes.'),
('roles.manage','Gestionar roles desde el panel administrativo.')
on conflict (code) do update set description=excluded.description;

insert into public.pf_rbac_role_permissions(role_code,permission_code) values
('usuario','profile.read'),('usuario','profile.manage'),('usuario','community.read'),('usuario','advice.request'),('usuario','reports.submit'),
('creador','content.create'),('creador','content.manage_own'),
('streamer','stream.manage_own'),
('programador','developer.tools'),('programador','community.help'),
('aficionado','community.help'),
('colaborador','advice.give'),('colaborador','community.help'),
('moderador','content.moderate'),('moderador','reports.manage')
on conflict do nothing;

alter table public.pf_rbac_roles enable row level security;
alter table public.pf_rbac_permissions enable row level security;
alter table public.pf_rbac_role_permissions enable row level security;
alter table public.pf_rbac_user_roles enable row level security;
alter table public.pf_rbac_audit enable row level security;

drop policy if exists "PF RBAC authenticated reads roles" on public.pf_rbac_roles;
create policy "PF RBAC authenticated reads roles" on public.pf_rbac_roles
for select to authenticated using (true);

drop policy if exists "PF RBAC authenticated reads permissions" on public.pf_rbac_permissions;
create policy "PF RBAC authenticated reads permissions" on public.pf_rbac_permissions
for select to authenticated using (true);

drop policy if exists "PF RBAC authenticated reads role permissions" on public.pf_rbac_role_permissions;
create policy "PF RBAC authenticated reads role permissions" on public.pf_rbac_role_permissions
for select to authenticated using (true);

drop policy if exists "PF RBAC users read own assigned roles" on public.pf_rbac_user_roles;
create policy "PF RBAC users read own assigned roles" on public.pf_rbac_user_roles
for select to authenticated using (user_id = auth.uid() or public.pixelforge_es_admin());

revoke all on public.pf_rbac_roles from anon, authenticated;
revoke all on public.pf_rbac_permissions from anon, authenticated;
revoke all on public.pf_rbac_role_permissions from anon, authenticated;
revoke all on public.pf_rbac_user_roles from anon, authenticated;
revoke all on public.pf_rbac_audit from anon, authenticated;
grant select on public.pf_rbac_roles, public.pf_rbac_permissions, public.pf_rbac_role_permissions, public.pf_rbac_user_roles to authenticated;

create or replace function public.pf_rbac_list_users()
returns table(user_id uuid, email text, display_name text, created_at timestamptz, roles text[])
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null or not public.pixelforge_es_admin() then
    raise exception 'Solo la superadministración puede consultar la lista de usuarios.';
  end if;
  return query
  select u.id,
         u.email::text,
         coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), nullif(u.raw_user_meta_data->>'nombre_publico',''), split_part(coalesce(u.email,''),'@',1))::text,
         u.created_at,
         case
           when exists(select 1 from public.pixelforge_admins a where a.user_id=u.id)
             then array['superadministrador']::text[]
           else array_prepend('usuario', coalesce(array_agg(distinct ur.role_code) filter (where ur.role_code is not null), array[]::text[]))
         end
    from auth.users u
    left join public.pf_rbac_user_roles ur on ur.user_id=u.id
   group by u.id, u.email, u.raw_user_meta_data, u.created_at
   order by u.created_at desc
   limit 500;
end;
$$;

create or replace function public.pf_rbac_assign_role(p_user_id uuid, p_role_code text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_assignable boolean;
begin
  if auth.uid() is null or not public.pixelforge_es_admin() then
    raise exception 'Solo la superadministración puede asignar roles.';
  end if;
  if p_user_id is null or p_role_code is null then raise exception 'Falta el usuario o el rol.'; end if;
  if exists(select 1 from public.pixelforge_admins where user_id=p_user_id) then
    raise exception 'La cuenta superadministradora se gestiona desde pixelforge_admins.';
  end if;
  select assignable into v_assignable from public.pf_rbac_roles where code=p_role_code;
  if not found or not v_assignable then raise exception 'Este rol está reservado o no existe.'; end if;
  insert into public.pf_rbac_user_roles(user_id,role_code,assigned_by)
  values(p_user_id,p_role_code,auth.uid())
  on conflict(user_id,role_code) do nothing;
  if not found then raise exception 'El usuario ya tiene asignado ese rol.'; end if;
  insert into public.pf_rbac_audit(target_user_id,role_code,action,actor_user_id)
  values(p_user_id,p_role_code,'assigned',auth.uid());
end;
$$;

create or replace function public.pf_rbac_remove_role(p_user_id uuid, p_role_code text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_assignable boolean; v_deleted integer;
begin
  if auth.uid() is null or not public.pixelforge_es_admin() then
    raise exception 'Solo la superadministración puede retirar roles.';
  end if;
  if exists(select 1 from public.pixelforge_admins where user_id=p_user_id) then
    raise exception 'No se pueden modificar los privilegios raíz desde este panel.';
  end if;
  select assignable into v_assignable from public.pf_rbac_roles where code=p_role_code;
  if not found or not v_assignable then raise exception 'Este rol está reservado o no existe.'; end if;
  delete from public.pf_rbac_user_roles where user_id=p_user_id and role_code=p_role_code;
  get diagnostics v_deleted = row_count;
  if v_deleted=0 then raise exception 'El usuario no tiene asignado ese rol.'; end if;
  insert into public.pf_rbac_audit(target_user_id,role_code,action,actor_user_id)
  values(p_user_id,p_role_code,'removed',auth.uid());
end;
$$;

create or replace function public.pf_rbac_my_roles()
returns text[]
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when auth.uid() is null then array[]::text[]
    when public.pixelforge_es_admin() then array['superadministrador']::text[]
    else array_prepend(
      'usuario',
      coalesce(
        (select array_agg(ur.role_code order by ur.role_code)
           from public.pf_rbac_user_roles ur
          where ur.user_id = auth.uid()),
        array[]::text[]
      )
    )
  end;
$$;

create or replace function public.pf_rbac_has_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select case
    when auth.uid() is null then false
    when public.pixelforge_es_admin() then true
    when p_permission_code='profile.read' or p_permission_code='profile.manage' or p_permission_code='community.read' or p_permission_code='advice.request' or p_permission_code='reports.submit' then true
    else exists (
      select 1
      from public.pf_rbac_user_roles ur
      join public.pf_rbac_role_permissions rp on rp.role_code=ur.role_code
      where ur.user_id=auth.uid() and rp.permission_code=p_permission_code
    )
  end;
$$;

revoke all on function public.pf_rbac_list_users() from public, anon;
revoke all on function public.pf_rbac_assign_role(uuid,text) from public, anon;
revoke all on function public.pf_rbac_remove_role(uuid,text) from public, anon;
revoke all on function public.pf_rbac_my_roles() from public, anon;
revoke all on function public.pf_rbac_has_permission(text) from public, anon;
grant execute on function public.pf_rbac_list_users() to authenticated;
grant execute on function public.pf_rbac_assign_role(uuid,text) to authenticated;
grant execute on function public.pf_rbac_remove_role(uuid,text) to authenticated;
grant execute on function public.pf_rbac_my_roles() to authenticated;
grant execute on function public.pf_rbac_has_permission(text) to authenticated;

create index if not exists pf_rbac_user_roles_user_idx on public.pf_rbac_user_roles(user_id);
create index if not exists pf_rbac_audit_target_idx on public.pf_rbac_audit(target_user_id,created_at desc);

notify pgrst, 'reload schema';
commit;
