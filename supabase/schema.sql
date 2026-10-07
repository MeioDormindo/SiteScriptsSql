-- SQL Script Manager - schema da nuvem (Supabase / Postgres).
-- Rode inteiro no SQL Editor do Supabase. E idempotente: pode rodar de novo apos atualizacoes.
--
-- Senhas: ficam so no Supabase Auth (auth.users), como hash bcrypt. Nenhuma tabela daqui guarda senha.
-- Seguranca: Row Level Security em todas as tabelas; a chave publica (anon) so consegue
-- consultar uma lista compartilhada informando o codigo exato.

create extension if not exists pgcrypto with schema extensions;

-- =====================================================================
-- 1. Dados de cada usuario: uma linha por script/pasta/categoria/assinatura
-- =====================================================================
create table if not exists public.sync_items (
  user_id     uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  kind        text        not null check (kind in ('script','folder','category','subscription')),
  id          text        not null check (id ~ '^[A-Za-z0-9_-]{1,64}$'),
  data        jsonb,
  deleted     boolean     not null default false,
  modified_at timestamptz not null,                                -- horario da alteracao (regra: ultimo a gravar vence)
  updated_at  timestamptz not null default clock_timestamp(),     -- horario de gravacao no servidor (cursor do pull)
  primary key (user_id, kind, id),
  constraint sync_items_shape check ((deleted and data is null) or (not deleted and data is not null)),
  constraint sync_items_size  check (data is null or octet_length(data::text) <= 1048576)
);
create index if not exists sync_items_pull_idx on public.sync_items (user_id, updated_at);
alter table public.sync_items enable row level security;

drop policy if exists sync_items_select on public.sync_items;
create policy sync_items_select on public.sync_items for select to authenticated
  using ((select auth.uid()) = user_id);
drop policy if exists sync_items_insert on public.sync_items;
create policy sync_items_insert on public.sync_items for insert to authenticated
  with check ((select auth.uid()) = user_id);
drop policy if exists sync_items_update on public.sync_items;
create policy sync_items_update on public.sync_items for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- Sem policy de DELETE de proposito: o app grava exclusoes como "deleted = true".
-- Excluir a conta remove tudo em cascata.
revoke all on public.sync_items from anon;
grant select, insert, update on public.sync_items to authenticated;

-- Ultimo a gravar vence: descarta gravacoes mais antigas que a do servidor e corrige relogios adiantados.
create or replace function public.sync_items_guard() returns trigger
language plpgsql set search_path = '' as $$
declare v_now timestamptz := date_trunc('milliseconds', clock_timestamp());
begin
  if new.modified_at > v_now + interval '5 minutes' then
    new.modified_at := v_now;
  end if;
  if tg_op = 'UPDATE' then
    if new.modified_at <= old.modified_at then
      return null;                                   -- gravacao antiga: ignora a linha
    end if;
    new.user_id := old.user_id; new.kind := old.kind; new.id := old.id;
  end if;
  if new.deleted then new.data := null; end if;
  new.updated_at := v_now;
  return new;
end $$;
drop trigger if exists sync_items_guard on public.sync_items;
create trigger sync_items_guard before insert or update on public.sync_items
  for each row execute function public.sync_items_guard();

-- Limite de 20.000 itens por usuario, verificado uma vez por comando.
create or replace function public.sync_items_quota() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.sync_items s
    where s.user_id in (select distinct n.user_id from new_rows n)
    group by s.user_id having count(*) > 20000
  ) then
    raise exception 'quota_exceeded' using errcode = 'P0001';
  end if;
  return null;
end $$;
drop trigger if exists sync_items_quota on public.sync_items;
create trigger sync_items_quota after insert on public.sync_items
  referencing new table as new_rows
  for each statement execute function public.sync_items_quota();

-- =====================================================================
-- 2. Listas publicadas (compartilhadas por codigo)
-- =====================================================================
create table if not exists public.shared_lists (
  id               uuid        primary key default gen_random_uuid(),
  owner_id         uuid        not null default auth.uid() references auth.users(id) on delete cascade,
  code             text        not null unique check (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$'),
  name             text        not null check (char_length(name) between 1 and 120),
  source_folder_id text        check (source_folder_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  version          integer     not null default 1,
  snapshot         jsonb       not null,
  snapshot_hash    text        not null default '',
  script_count     integer     not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint shared_lists_size check (octet_length(snapshot::text) <= 2097152)
);
create index if not exists shared_lists_owner_idx on public.shared_lists (owner_id);
alter table public.shared_lists enable row level security;

drop policy if exists shared_lists_owner_select on public.shared_lists;
create policy shared_lists_owner_select on public.shared_lists for select to authenticated
  using ((select auth.uid()) = owner_id);
drop policy if exists shared_lists_owner_insert on public.shared_lists;
create policy shared_lists_owner_insert on public.shared_lists for insert to authenticated
  with check ((select auth.uid()) = owner_id);
drop policy if exists shared_lists_owner_update on public.shared_lists;
create policy shared_lists_owner_update on public.shared_lists for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
drop policy if exists shared_lists_owner_delete on public.shared_lists;
create policy shared_lists_owner_delete on public.shared_lists for delete to authenticated
  using ((select auth.uid()) = owner_id);
revoke all on public.shared_lists from anon;
grant select, insert, update, delete on public.shared_lists to authenticated;

-- Codigo de 8 caracteres sem simbolos ambiguos (sem 0 O 1 I L): ~8,5 x 10^11 combinacoes.
create or replace function public.gen_share_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  b bytea; r text := ''; i int; v int;
begin
  while char_length(r) < 8 loop
    b := extensions.gen_random_bytes(16); i := 0;
    while i < 16 and char_length(r) < 8 loop
      v := get_byte(b, i);
      if v < 248 then r := r || substr(alphabet, (v % 31) + 1, 1); end if;   -- amostragem sem vies
      i := i + 1;
    end loop;
  end loop;
  return r;
end $$;

-- SECURITY DEFINER para que o teste de unicidade enxergue os codigos de todos os donos.
create or replace function public.shared_lists_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if jsonb_typeof(new.snapshot -> 'scripts') is distinct from 'array' then
    raise exception 'invalid_snapshot' using errcode = 'P0001';
  end if;
  new.script_count  := jsonb_array_length(new.snapshot -> 'scripts');
  new.snapshot_hash := md5(new.snapshot::text);
  if tg_op = 'INSERT' then
    select count(*) into n from public.shared_lists where owner_id = new.owner_id;
    if n >= 20 then raise exception 'list_limit' using errcode = 'P0001'; end if;
    loop
      new.code := public.gen_share_code();            -- codigo enviado pelo cliente e ignorado
      exit when not exists (select 1 from public.shared_lists where code = new.code);
    end loop;
    new.version := 1; new.created_at := now(); new.updated_at := now();
  else
    new.id := old.id; new.owner_id := old.owner_id; new.code := old.code; new.created_at := old.created_at;
    if new.snapshot_hash is distinct from old.snapshot_hash or new.name is distinct from old.name then
      new.version := old.version + 1; new.updated_at := now();
    else
      new.version := old.version; new.updated_at := old.updated_at;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists shared_lists_guard on public.shared_lists;
create trigger shared_lists_guard before insert or update on public.shared_lists
  for each row execute function public.shared_lists_guard();

-- Consulta por codigo exato (nunca lista). Devolve o snapshot so quando a versao mudou.
-- Pode ser chamada sem login: assinar uma lista nao exige conta.
create or replace function public.get_shared_list(p_code text, p_known_version integer default null)
returns table (name text, version integer, updated_at timestamptz, script_count integer, snapshot jsonb)
language sql stable security definer set search_path = '' as $$
  select l.name, l.version, l.updated_at, l.script_count,
         case when p_known_version is not distinct from l.version then null else l.snapshot end
  from public.shared_lists l
  where p_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$' and l.code = p_code;
$$;

-- LGPD: exclui a conta e todos os dados (cascata em sync_items e shared_lists).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from auth.users where id = v_uid;
end $$;

-- Permissoes das funcoes (o Supabase concede EXECUTE a anon/authenticated por padrao).
revoke execute on function public.gen_share_code()               from public, anon, authenticated;
revoke execute on function public.sync_items_guard()             from public, anon, authenticated;
revoke execute on function public.sync_items_quota()             from public, anon, authenticated;
revoke execute on function public.shared_lists_guard()           from public, anon, authenticated;
revoke execute on function public.delete_my_account()            from public, anon;
grant  execute on function public.delete_my_account()            to authenticated;
revoke execute on function public.get_shared_list(text, integer) from public;
grant  execute on function public.get_shared_list(text, integer) to anon, authenticated;
