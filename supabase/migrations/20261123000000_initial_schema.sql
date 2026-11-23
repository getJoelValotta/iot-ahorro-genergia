-- Esquema inicial del backend (docs/06 §5).
-- Solo accede la clave de servicio del backend: RLS activado SIN políticas, así las claves
-- públicas (anon/authenticated) no pueden leer ni escribir nada.

create extension if not exists pgcrypto;

-- Mantiene updated_at al día en cada UPDATE.
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Usuarios (auth propia: bcrypt + JWT emitido por el backend)
-- ---------------------------------------------------------------------------
create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text not null,
  phone         text,
  password_hash text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint users_email_key unique (email),
  constraint users_email_lowercase check (email = lower(email))
);

create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mascotas (+ vínculo con el collar y estado de la variante power-saving)
-- ---------------------------------------------------------------------------
create table public.pets (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.users (id) on delete cascade,
  name                  text not null,
  species               text not null check (species in ('dog', 'cat', 'other')),
  breed                 text,
  birth_date            date,
  photo_url             text,
  -- deviceId de Ovenbird. La unicidad garantiza el 409 DEVICE_ALREADY_LINKED en la base.
  device_id             text,
  power_mode            text not null default 'normal' check (power_mode in ('normal', 'saving')),
  power_command_id      text,
  power_command_status  text not null default 'none'
                        check (power_command_status in ('none', 'pending', 'confirmed', 'failed')),
  power_requested_at    timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint pets_device_id_key unique (device_id)
);

create index pets_owner_created_idx on public.pets (owner_id, created_at, id);

create trigger pets_set_updated_at before update on public.pets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Sesiones de emparejamiento: ventana de 10 min por código para filtrar GET /devices
-- ---------------------------------------------------------------------------
create table public.pairing_sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  code        text not null,
  expires_at  timestamptz not null,
  created_at  timestamptz not null default now()
);

create index pairing_sessions_user_idx on public.pairing_sessions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security sin políticas: solo service_role (que la saltea) puede operar.
-- ---------------------------------------------------------------------------
alter table public.users enable row level security;
alter table public.pets enable row level security;
alter table public.pairing_sessions enable row level security;

revoke all on public.users, public.pets, public.pairing_sessions from anon, authenticated;
-- Las versiones nuevas de Supabase ya no dan permisos automáticos sobre tablas nuevas:
-- se los damos explícitamente a la clave de servicio del backend.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.users, public.pets, public.pairing_sessions to service_role;
