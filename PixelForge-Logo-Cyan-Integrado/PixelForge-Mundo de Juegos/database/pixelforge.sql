begin;
create extension if not exists pgcrypto;

create table if not exists public.pixelforge_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now()
);
alter table public.pixelforge_admins enable row level security;
drop policy if exists "PF V8 admin reads own row" on public.pixelforge_admins;
create policy "PF V8 admin reads own row"
  on public.pixelforge_admins for select to authenticated
  using (user_id = auth.uid());
grant select on public.pixelforge_admins to authenticated;

create or replace function public.pixelforge_es_admin()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.pixelforge_admins a where a.user_id = auth.uid()
  );
$$;
revoke all on function public.pixelforge_es_admin() from public;
grant execute on function public.pixelforge_es_admin() to anon, authenticated;

create table if not exists public.catalogo_publico (
  slug text primary key,
  nombre text not null check (char_length(nombre) between 1 and 100),
  genero text not null default 'Otro',
  descripcion text,
  clasificacion_edad text not null default 'Pendiente de verificar',
  sitio_oficial text not null check (sitio_oficial ~* '^https://'),
  imagen_url text check (imagen_url is null or imagen_url ~* '^https://'),
  streamers text,
  es_infantil boolean not null default false,
  aprobado boolean not null default false,
  creado_en timestamptz not null default now()
);
alter table public.catalogo_publico
  add column if not exists slug text,
  add column if not exists nombre text,
  add column if not exists genero text default 'Otro',
  add column if not exists descripcion text,
  add column if not exists clasificacion_edad text default 'Pendiente de verificar',
  add column if not exists sitio_oficial text,
  add column if not exists imagen_url text,
  add column if not exists streamers text,
  add column if not exists es_infantil boolean not null default false,
  add column if not exists aprobado boolean not null default false,
  add column if not exists creado_en timestamptz not null default now();

update public.catalogo_publico
set slug = 'juego-' || substr(md5(ctid::text), 1, 12)
where slug is null or btrim(slug) = '';
update public.catalogo_publico
set nombre = 'Videojuego importado'
where nombre is null or btrim(nombre) = '';
update public.catalogo_publico
set genero = 'Otro'
where genero is null or btrim(genero) = '';
update public.catalogo_publico
set clasificacion_edad = 'Pendiente de verificar'
where clasificacion_edad is null or btrim(clasificacion_edad) = '';
create unique index if not exists pf_v8_catalogo_slug_uq on public.catalogo_publico(slug);

alter table public.catalogo_publico enable row level security;
drop policy if exists "PF anyone reads approved games" on public.catalogo_publico;
drop policy if exists "PF V8 reads approved catalog" on public.catalogo_publico;
drop policy if exists "PF V8 admin inserts catalog" on public.catalogo_publico;
drop policy if exists "PF V8 admin updates catalog" on public.catalogo_publico;
drop policy if exists "PF V8 admin deletes catalog" on public.catalogo_publico;
create policy "PF V8 reads approved catalog"
  on public.catalogo_publico for select to anon, authenticated
  using (aprobado = true or public.pixelforge_es_admin());
create policy "PF V8 admin inserts catalog"
  on public.catalogo_publico for insert to authenticated
  with check (public.pixelforge_es_admin());
create policy "PF V8 admin updates catalog"
  on public.catalogo_publico for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
create policy "PF V8 admin deletes catalog"
  on public.catalogo_publico for delete to authenticated
  using (public.pixelforge_es_admin());
grant select on public.catalogo_publico to anon, authenticated;
grant insert, update, delete on public.catalogo_publico to authenticated;

create table if not exists public.propuestas_videojuegos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(trim(nombre)) between 1 and 100),
  genero text not null default 'Otro',
  clasificacion_edad text not null default 'Pendiente de verificar',
  sitio_oficial text not null check (sitio_oficial ~* '^https://'),
  imagen_url text check (imagen_url is null or imagen_url ~* '^https://'),
  streamers text,
  descripcion text,
  creado_por uuid references auth.users(id) on delete set null,
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  creado_en timestamptz not null default now()
);
alter table public.propuestas_videojuegos
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists nombre text,
  add column if not exists genero text default 'Otro',
  add column if not exists clasificacion_edad text default 'Pendiente de verificar',
  add column if not exists sitio_oficial text,
  add column if not exists imagen_url text,
  add column if not exists streamers text,
  add column if not exists descripcion text,
  add column if not exists creado_por uuid references auth.users(id) on delete set null,
  add column if not exists estado text not null default 'pendiente',
  add column if not exists creado_en timestamptz not null default now();
update public.propuestas_videojuegos set nombre = 'Propuesta importada' where nombre is null or btrim(nombre) = '';
update public.propuestas_videojuegos set genero = 'Otro' where genero is null or btrim(genero) = '';
update public.propuestas_videojuegos set clasificacion_edad = 'Pendiente de verificar' where clasificacion_edad is null or btrim(clasificacion_edad) = '';
update public.propuestas_videojuegos set estado = 'pendiente' where estado is null or estado not in ('pendiente','aprobada','rechazada');

alter table public.propuestas_videojuegos enable row level security;
drop policy if exists "PF V8 public submits proposals" on public.propuestas_videojuegos;
drop policy if exists "PF V8 admins read proposals" on public.propuestas_videojuegos;
drop policy if exists "PF V8 admins update proposals" on public.propuestas_videojuegos;
create policy "PF V8 public submits proposals"
  on public.propuestas_videojuegos for insert to anon, authenticated
  with check (
    estado = 'pendiente'
    and (creado_por is null or creado_por = auth.uid())
    and sitio_oficial ~* '^https://'
    and (imagen_url is null or imagen_url ~* '^https://')
  );
create policy "PF V8 admins read proposals"
  on public.propuestas_videojuegos for select to authenticated
  using (public.pixelforge_es_admin());
create policy "PF V8 admins update proposals"
  on public.propuestas_videojuegos for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
grant insert on public.propuestas_videojuegos to anon, authenticated;
grant select, update on public.propuestas_videojuegos to authenticated;

commit;

alter table public.catalogo_publico
  add column if not exists requisitos_minimos text,
  add column if not exists requisitos_recomendados text;

begin;
create extension if not exists pgcrypto;

do $$
begin
  if to_regprocedure('public.pixelforge_es_admin()') is null then
    raise exception 'Falta public.pixelforge_es_admin(). Ejecuta primero la migración base de PixelForge V8.';
  end if;
end;
$$;

-- 1) Solicitudes de desarrolladores, creadores y posibles colaboradores.
create table if not exists public.pf_v9_creator_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  nombre_publico text not null check (char_length(trim(nombre_publico)) between 1 and 100),
  alias text not null check (char_length(trim(alias)) between 1 and 60),
  correo text not null check (char_length(trim(correo)) between 3 and 160),
  perfil text not null check (perfil in ('desarrollador','streamer','ambos')),
  nombre_idea_videojuego text,
  concepto_videojuego text,
  ya_creo_videojuego text not null check (ya_creo_videojuego in ('no','si','en_proceso')),
  ya_hizo_streams text not null check (ya_hizo_streams in ('no','si')),
  videojuego_existente text,
  enlace_videojuego text check (enlace_videojuego is null or enlace_videojuego ~* '^https?://'),
  experiencia_desarrollo text,
  plataforma_stream text,
  canal_stream text check (canal_stream is null or canal_stream ~* '^https?://'),
  experiencia_stream text,
  propuesta text not null check (char_length(trim(propuesta)) between 1 and 2000),
  acepta_cuota_informada boolean not null default false,
  acepta_revision_datos boolean not null default false,
  cuota_recuperacion_mxn numeric(8,2) not null default 50 check (cuota_recuperacion_mxn between 0 and 10000),
  cuota_estado text not null default 'no_cobrada' check (cuota_estado in ('no_cobrada','pendiente','confirmada','exenta','cancelada')),
  estado text not null default 'pendiente' check (estado in ('pendiente','en_revision','aprobada','rechazada','archivada')),
  notas_administracion text
);

alter table public.pf_v9_creator_applications enable row level security;
drop policy if exists "PF V9 public submit creator application" on public.pf_v9_creator_applications;
create policy "PF V9 public submit creator application"
  on public.pf_v9_creator_applications for insert to anon, authenticated
  with check (
    estado = 'pendiente'
    and cuota_estado = 'no_cobrada'
    and acepta_cuota_informada = true
    and acepta_revision_datos = true
    and (created_by is null or created_by = auth.uid())
  );
drop policy if exists "PF V9 admin reads creator applications" on public.pf_v9_creator_applications;
create policy "PF V9 admin reads creator applications"
  on public.pf_v9_creator_applications for select to authenticated
  using (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin updates creator applications" on public.pf_v9_creator_applications;
create policy "PF V9 admin updates creator applications"
  on public.pf_v9_creator_applications for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin deletes creator applications" on public.pf_v9_creator_applications;
create policy "PF V9 admin deletes creator applications"
  on public.pf_v9_creator_applications for delete to authenticated
  using (public.pixelforge_es_admin());
grant insert on public.pf_v9_creator_applications to anon, authenticated;
grant select, update, delete on public.pf_v9_creator_applications to authenticated;
create index if not exists pf_v9_creator_created_idx on public.pf_v9_creator_applications(created_at desc);
create index if not exists pf_v9_creator_status_idx on public.pf_v9_creator_applications(estado, cuota_estado);

create table if not exists public.pf_v9_stream_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  nombre_publico text not null check (char_length(trim(nombre_publico)) between 1 and 100),
  correo text not null check (char_length(trim(correo)) between 3 and 160),
  plataforma text not null check (plataforma in ('Twitch','YouTube')),
  url_canal text not null check (url_canal ~* '^https?://'),
  contenido text not null check (char_length(trim(contenido)) between 1 and 1200),
  permiso_declarado boolean not null default false,
  acepta_reglas boolean not null default false,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_revision','aprobada','rechazada')),
  notas_administracion text
);

alter table public.pf_v9_stream_requests enable row level security;
drop policy if exists "PF V9 public submit stream request" on public.pf_v9_stream_requests;
create policy "PF V9 public submit stream request"
  on public.pf_v9_stream_requests for insert to anon, authenticated
  with check (
    estado = 'pendiente'
    and permiso_declarado = true
    and acepta_reglas = true
    and (created_by is null or created_by = auth.uid())
  );
drop policy if exists "PF V9 admin reads stream requests" on public.pf_v9_stream_requests;
create policy "PF V9 admin reads stream requests"
  on public.pf_v9_stream_requests for select to authenticated
  using (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin updates stream requests" on public.pf_v9_stream_requests;
create policy "PF V9 admin updates stream requests"
  on public.pf_v9_stream_requests for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin deletes stream requests" on public.pf_v9_stream_requests;
create policy "PF V9 admin deletes stream requests"
  on public.pf_v9_stream_requests for delete to authenticated
  using (public.pixelforge_es_admin());
grant insert on public.pf_v9_stream_requests to anon, authenticated;
grant select, update, delete on public.pf_v9_stream_requests to authenticated;
create index if not exists pf_v9_stream_created_idx on public.pf_v9_stream_requests(created_at desc);
create index if not exists pf_v9_stream_status_idx on public.pf_v9_stream_requests(estado);

create table if not exists public.pf_v9_featured_streams (
  id uuid primary key default gen_random_uuid(),
  solicitud_id uuid unique references public.pf_v9_stream_requests(id) on delete set null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  nombre_publico text not null check (char_length(trim(nombre_publico)) between 1 and 100),
  plataforma text not null check (plataforma in ('Twitch','YouTube')),
  url_canal text not null check (url_canal ~* '^https?://'),
  canal_twitch text check (canal_twitch is null or canal_twitch ~ '^[A-Za-z0-9_]{1,60}$'),
  activo boolean not null default true
);

alter table public.pf_v9_featured_streams enable row level security;
drop policy if exists "PF V9 public reads active featured streams" on public.pf_v9_featured_streams;
create policy "PF V9 public reads active featured streams"
  on public.pf_v9_featured_streams for select to anon, authenticated
  using (activo = true or public.pixelforge_es_admin());
drop policy if exists "PF V9 admin inserts featured streams" on public.pf_v9_featured_streams;
create policy "PF V9 admin inserts featured streams"
  on public.pf_v9_featured_streams for insert to authenticated
  with check (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin updates featured streams" on public.pf_v9_featured_streams;
create policy "PF V9 admin updates featured streams"
  on public.pf_v9_featured_streams for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin deletes featured streams" on public.pf_v9_featured_streams;
create policy "PF V9 admin deletes featured streams"
  on public.pf_v9_featured_streams for delete to authenticated
  using (public.pixelforge_es_admin());
grant select on public.pf_v9_featured_streams to anon, authenticated;
grant insert, update, delete on public.pf_v9_featured_streams to authenticated;
create index if not exists pf_v9_featured_active_idx on public.pf_v9_featured_streams(activo, created_at desc);

create table if not exists public.pf_v9_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  tipo text not null check (char_length(trim(tipo)) between 1 and 80),
  resumen text not null check (char_length(trim(resumen)) between 1 and 120),
  detalle text not null check (char_length(trim(detalle)) between 1 and 2500),
  pagina_url text,
  navegador text,
  estado text not null default 'pendiente' check (estado in ('pendiente','en_revision','resuelto','cerrado')),
  notas_administracion text
);

-- Compatibilidad con instalaciones donde la tabla ya existía sin estas columnas.
alter table public.pf_v9_reports add column if not exists pagina_url text;
alter table public.pf_v9_reports add column if not exists navegador text;

alter table public.pf_v9_reports enable row level security;
drop policy if exists "PF V9 public submit reports" on public.pf_v9_reports;
create policy "PF V9 public submit reports"
  on public.pf_v9_reports for insert to anon, authenticated
  with check (
    estado = 'pendiente'
    and (created_by is null or created_by = auth.uid())
  );
drop policy if exists "PF V9 admin reads reports" on public.pf_v9_reports;
create policy "PF V9 admin reads reports"
  on public.pf_v9_reports for select to authenticated
  using (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin updates reports" on public.pf_v9_reports;
create policy "PF V9 admin updates reports"
  on public.pf_v9_reports for update to authenticated
  using (public.pixelforge_es_admin())
  with check (public.pixelforge_es_admin());
drop policy if exists "PF V9 admin deletes reports" on public.pf_v9_reports;
create policy "PF V9 admin deletes reports"
  on public.pf_v9_reports for delete to authenticated
  using (public.pixelforge_es_admin());
grant insert on public.pf_v9_reports to anon, authenticated;
grant select, update, delete on public.pf_v9_reports to authenticated;
create index if not exists pf_v9_reports_created_idx on public.pf_v9_reports(created_at desc);
create index if not exists pf_v9_reports_status_idx on public.pf_v9_reports(estado);

commit;


begin;

drop policy if exists "PF V10 users read own reports" on public.pf_v9_reports;
create policy "PF V10 users read own reports"
  on public.pf_v9_reports for select to authenticated
  using (created_by = auth.uid());

create table if not exists public.pf_v10_collaborators (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nombre_publico text not null check (char_length(trim(nombre_publico)) between 1 and 100),
  especialidad text not null check (especialidad in ('streamer','programador','aficionado')),
  presentacion text not null check (char_length(trim(presentacion)) between 1 and 700),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobado','rechazado','suspendido')),
  disponible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pf_v10_collaborators enable row level security;
drop policy if exists "PF V10 users read approved collaborators or own" on public.pf_v10_collaborators;
create policy "PF V10 users read approved collaborators or own"
  on public.pf_v10_collaborators for select to authenticated
  using (estado = 'aprobado' or user_id = auth.uid() or public.pixelforge_es_admin());
drop policy if exists "PF V10 users submit own collaborator application" on public.pf_v10_collaborators;
create policy "PF V10 users submit own collaborator application"
  on public.pf_v10_collaborators for insert to authenticated
  with check (user_id = auth.uid() and estado = 'pendiente' and disponible = false);
drop policy if exists "PF V10 collaborator updates own availability" on public.pf_v10_collaborators;
create policy "PF V10 collaborator updates own availability"
  on public.pf_v10_collaborators for update to authenticated
  using (user_id = auth.uid() and estado = 'aprobado')
  with check (user_id = auth.uid() and estado = 'aprobado');

grant select, insert on public.pf_v10_collaborators to authenticated;
revoke update on public.pf_v10_collaborators from authenticated;
grant update (disponible) on public.pf_v10_collaborators to authenticated;

create or replace function public.pf_v10_set_collaborator_status(p_user_id uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_especialidad text;
  v_cargo text;
begin
  if not public.pixelforge_es_admin() then
    raise exception 'Solo la superadministración puede modificar el estado de colaboradores.';
  end if;

  if p_estado not in ('pendiente','aprobado','rechazado','suspendido') then
    raise exception 'Estado de colaborador no válido.';
  end if;

  select especialidad
    into v_especialidad
    from public.pf_v10_collaborators
   where user_id = p_user_id
   for update;

  if not found then
    raise exception 'No se encontró el perfil del colaborador.';
  end if;

  update public.pf_v10_collaborators
     set estado = p_estado,
         updated_at = now()
   where user_id = p_user_id;

  if p_estado = 'aprobado' then
    v_cargo := case v_especialidad
      when 'streamer' then 'Streamer'
      when 'programador' then 'Programador'
      when 'aficionado' then 'Aficionado a los videojuegos'
      else v_especialidad
    end;

    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         || jsonb_build_object('pixelforge_status', v_cargo)
     where id = p_user_id;
  else
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
         - 'pixelforge_status'
     where id = p_user_id;
  end if;
end;
$$;
revoke all on function public.pf_v10_set_collaborator_status(uuid,text) from public;
grant execute on function public.pf_v10_set_collaborator_status(uuid,text) to authenticated;

-- 3) Solicitudes de asesoría entre usuarios y colaboradores.
create table if not exists public.pf_v10_advice_requests (
  id uuid primary key default gen_random_uuid(),
  solicitante_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  colaborador_id uuid not null references public.pf_v10_collaborators(user_id) on delete cascade,
  tema text not null check (char_length(trim(tema)) between 1 and 120),
  mensaje text not null check (char_length(trim(mensaje)) between 1 and 1200),
  estado text not null default 'pendiente' check (estado in ('pendiente','aceptada','rechazada','en_curso','finalizada','cancelada')),
  respuesta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pf_v10_advice_requests enable row level security;
drop policy if exists "PF V10 involved users read advice requests" on public.pf_v10_advice_requests;
create policy "PF V10 involved users read advice requests"
  on public.pf_v10_advice_requests for select to authenticated
  using (solicitante_id = auth.uid() or colaborador_id = auth.uid() or public.pixelforge_es_admin());
drop policy if exists "PF V10 users request approved available collaborators" on public.pf_v10_advice_requests;
create policy "PF V10 users request approved available collaborators"
  on public.pf_v10_advice_requests for insert to authenticated
  with check (
    solicitante_id = auth.uid()
    and estado = 'pendiente'
    and exists (
      select 1 from public.pf_v10_collaborators c
       where c.user_id = colaborador_id and c.estado = 'aprobado' and c.disponible = true
    )
  );
drop policy if exists "PF V10 collaborators or admin update advice" on public.pf_v10_advice_requests;
create policy "PF V10 collaborators or admin update advice"
  on public.pf_v10_advice_requests for update to authenticated
  using (colaborador_id = auth.uid() or public.pixelforge_es_admin())
  with check (colaborador_id = auth.uid() or public.pixelforge_es_admin());

grant select, insert, update on public.pf_v10_advice_requests to authenticated;

create or replace function public.pf_v10_guard_advice_update()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.updated_at := now();
  if public.pixelforge_es_admin() then return new; end if;
  if old.colaborador_id <> auth.uid() then
    raise exception 'Solo el colaborador asignado o la superadministración puede actualizar esta asesoría.';
  end if;
  if new.solicitante_id is distinct from old.solicitante_id
     or new.colaborador_id is distinct from old.colaborador_id
     or new.tema is distinct from old.tema
     or new.mensaje is distinct from old.mensaje then
    raise exception 'No se pueden modificar los datos originales de la solicitud.';
  end if;
  if not (
    (old.estado = 'pendiente' and new.estado in ('aceptada','rechazada'))
    or (old.estado = 'aceptada' and new.estado in ('en_curso','rechazada'))
    or (old.estado = 'en_curso' and new.estado = 'finalizada')
  ) then
    raise exception 'Cambio de estado no permitido para esta asesoría.';
  end if;
  return new;
end;
$$;
drop trigger if exists pf_v10_advice_update_guard on public.pf_v10_advice_requests;
create trigger pf_v10_advice_update_guard
  before update on public.pf_v10_advice_requests
  for each row execute function public.pf_v10_guard_advice_update();

create table if not exists public.pf_v10_polls (
  id uuid primary key default gen_random_uuid(),
  question text not null check (char_length(trim(question)) between 5 and 180),
  options text[] not null check (cardinality(options) between 2 and 6),
  active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.pf_v10_polls enable row level security;
drop policy if exists "PF V10 users read active polls and admins read all" on public.pf_v10_polls;
create policy "PF V10 users read active polls and admins read all"
  on public.pf_v10_polls for select to authenticated
  using (active = true or public.pixelforge_es_admin());
drop policy if exists "PF V10 admins create polls" on public.pf_v10_polls;
create policy "PF V10 admins create polls"
  on public.pf_v10_polls for insert to authenticated
  with check (public.pixelforge_es_admin() and created_by = auth.uid());
drop policy if exists "PF V10 admins update polls" on public.pf_v10_polls;
create policy "PF V10 admins update polls"
  on public.pf_v10_polls for update to authenticated
  using (public.pixelforge_es_admin()) with check (public.pixelforge_es_admin());
drop policy if exists "PF V10 admins delete polls" on public.pf_v10_polls;
create policy "PF V10 admins delete polls"
  on public.pf_v10_polls for delete to authenticated
  using (public.pixelforge_es_admin());
grant select, insert, update, delete on public.pf_v10_polls to authenticated;

create table if not exists public.pf_v10_poll_votes (
  poll_id uuid not null references public.pf_v10_polls(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  option_index integer not null check (option_index between 1 and 6),
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);
alter table public.pf_v10_poll_votes enable row level security;
drop policy if exists "PF V10 users read own poll votes" on public.pf_v10_poll_votes;
create policy "PF V10 users read own poll votes"
  on public.pf_v10_poll_votes for select to authenticated
  using (user_id = auth.uid());
grant select on public.pf_v10_poll_votes to authenticated;
revoke insert, update, delete on public.pf_v10_poll_votes from anon, authenticated;

-- El voto se registra mediante RPC: una cuenta solo puede votar una vez por sondeo.
create or replace function public.pf_v10_vote_poll(p_poll_id uuid, p_option_index integer)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_options text[];
  v_active boolean;
  v_rows integer;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para votar.'; end if;
  select options, active into v_options, v_active
    from public.pf_v10_polls where id = p_poll_id;
  if not found or not v_active then raise exception 'Este sondeo ya no está activo.'; end if;
  if p_option_index < 1 or p_option_index > cardinality(v_options) then
    raise exception 'La opción seleccionada no es válida.';
  end if;
  insert into public.pf_v10_poll_votes(poll_id,user_id,option_index)
  values (p_poll_id,auth.uid(),p_option_index)
  on conflict (poll_id,user_id) do nothing;
  get diagnostics v_rows = row_count;
  if v_rows = 0 then raise exception 'Ya participaste en este sondeo.'; end if;
end;
$$;
revoke all on function public.pf_v10_vote_poll(uuid,integer) from public;
grant execute on function public.pf_v10_vote_poll(uuid,integer) to authenticated;

-- Los usuarios reciben resultados agregados, nunca la identidad de quienes votaron.
create or replace function public.pf_v10_poll_results(p_poll_id uuid)
returns table(option_index integer, option_label text, total_votes bigint)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_options text[];
begin
  if auth.uid() is null then raise exception 'Inicia sesión para consultar los resultados.'; end if;
  select p.options into v_options
    from public.pf_v10_polls p
   where p.id = p_poll_id and (p.active = true or public.pixelforge_es_admin());
  if not found then raise exception 'Sondeo no disponible.'; end if;
  return query
    select s.i::integer, v_options[s.i], count(v.option_index)::bigint
      from generate_subscripts(v_options,1) as s(i)
      left join public.pf_v10_poll_votes v
        on v.poll_id = p_poll_id and v.option_index = s.i
     group by s.i
     order by s.i;
end;
$$;
revoke all on function public.pf_v10_poll_results(uuid) from public;
grant execute on function public.pf_v10_poll_results(uuid) to authenticated;

create index if not exists pf_v10_advice_requester_idx
  on public.pf_v10_advice_requests(solicitante_id, created_at desc);
create index if not exists pf_v10_advice_collaborator_idx
  on public.pf_v10_advice_requests(colaborador_id, created_at desc);
create index if not exists pf_v10_collaborator_status_idx
  on public.pf_v10_collaborators(estado, disponible);
create index if not exists pf_v10_polls_active_idx
  on public.pf_v10_polls(active, created_at desc);

commit;


-- Actualizar la caché de esquema de la API REST de Supabase.
notify pgrst, 'reload schema';
