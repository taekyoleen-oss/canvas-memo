-- MindCanvas 전체 스키마 (새 프로젝트 SQL Editor에서 실행)
-- 생성일시: 2026-04-19

-- ── boards ────────────────────────────────────────────────────────────────

create table if not exists boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default '새 보드',
  icon        text not null default '📋',
  color       text not null default '#6366f1',
  board_category text not null default 'memo_schedule'
    check (board_category in ('memo_schedule', 'thinking')),
  sidebar_order int not null default 0,
  viewport    jsonb not null default '{"x":0,"y":0,"zoom":1}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table boards enable row level security;

create policy "boards_own" on boards
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── modules ───────────────────────────────────────────────────────────────

create table if not exists modules (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references boards(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('memo','schedule','image','link','file','table','brainstorm')),
  position    jsonb not null default '{"x":100,"y":100}',
  size        jsonb not null default '{"width":240,"height":120}',
  z_index     int  not null default 1,
  color       text not null default 'default',
  is_expanded boolean not null default false,
  is_minimized boolean not null default false,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table modules enable row level security;

create policy "modules_own" on modules
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── connections ───────────────────────────────────────────────────────────

create table if not exists connections (
  id              uuid primary key default gen_random_uuid(),
  board_id        uuid not null references boards(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  from_module_id  uuid not null references modules(id) on delete cascade,
  to_module_id    uuid not null references modules(id) on delete cascade,
  from_anchor     text not null check (from_anchor in ('top','right','bottom','left')),
  to_anchor       text not null check (to_anchor   in ('top','right','bottom','left')),
  label           text not null default '',
  style           text not null default 'solid' check (style in ('solid','dashed')),
  color           text not null default '#6366f1'
);

alter table connections enable row level security;

create policy "connections_own" on connections
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── groups ────────────────────────────────────────────────────────────────

create table if not exists groups (
  id           uuid primary key default gen_random_uuid(),
  board_id     uuid not null references boards(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  name         text not null default '그룹',
  module_ids   uuid[] not null default '{}',
  position     jsonb not null default '{"x":0,"y":0}',
  size         jsonb not null default '{"width":200,"height":200}',
  color        text not null default 'yellow',
  is_collapsed boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table groups enable row level security;

create policy "groups_own" on groups
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── updated_at 자동 갱신 트리거 ───────────────────────────────────────────

create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger boards_updated_at   before update on boards   for each row execute function touch_updated_at();
create trigger modules_updated_at  before update on modules  for each row execute function touch_updated_at();
create trigger groups_updated_at   before update on groups   for each row execute function touch_updated_at();

-- ── Storage: files 버킷 ───────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('files', 'files', false)
  on conflict (id) do nothing;

create policy "files_insert_own"
  on storage.objects for insert
  with check (
    bucket_id = 'files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "files_select_own"
  on storage.objects for select
  using (
    bucket_id = 'files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "files_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'files' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
