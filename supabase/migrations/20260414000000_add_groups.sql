-- groups 테이블 추가

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

create trigger groups_updated_at before update on groups
  for each row execute function touch_updated_at();
