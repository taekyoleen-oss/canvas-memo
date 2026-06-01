-- ============================================================
-- API Cost Monitor — Claude(Anthropic) + OpenAI 일별 비용 적재
-- 메모 테이블과 이름 충돌 없음. service_role 전용(RLS on, 정책 없음).
-- ============================================================

create table if not exists public.daily_costs (
  id          bigint generated always as identity primary key,
  provider    text        not null check (provider in ('anthropic', 'openai')),
  usage_date  date        not null,
  line_item   text        not null default 'total',
  amount_usd  numeric(12, 6) not null default 0,
  raw         jsonb,
  updated_at  timestamptz not null default now(),
  unique (provider, usage_date, line_item)
);

create index if not exists idx_daily_costs_provider_date
  on public.daily_costs (provider, usage_date desc);

create table if not exists public.budgets (
  provider          text primary key check (provider in ('anthropic', 'openai')),
  monthly_limit_usd numeric(12, 2) not null,
  alert_threshold   numeric(3, 2)  not null default 0.80,
  updated_at        timestamptz    not null default now()
);

create table if not exists public.sync_log (
  id          bigint generated always as identity primary key,
  ran_at      timestamptz not null default now(),
  provider    text,
  status      text not null,
  detail      text
);

create or replace view public.current_month_spend as
select
  provider,
  sum(amount_usd) as month_to_date_usd
from public.daily_costs
where usage_date >= date_trunc('month', current_date)
group by provider;

alter table public.daily_costs enable row level security;
alter table public.budgets     enable row level security;
alter table public.sync_log    enable row level security;
-- 정책 없음 → anon/authenticated 접근 불가. 서버는 service_role로 RLS 우회.

-- (선택) 예산 초기값. 필요 시 주석 해제 후 한도 조정:
-- insert into public.budgets (provider, monthly_limit_usd, alert_threshold)
-- values ('anthropic', 50, 0.8), ('openai', 50, 0.8)
-- on conflict (provider) do nothing;
