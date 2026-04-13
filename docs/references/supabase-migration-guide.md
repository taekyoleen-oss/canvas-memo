# MindCanvas Supabase 마이그레이션 가이드 (v2.0)

현재 MindCanvas는 localStorage 기반으로 동작합니다.
이 문서는 Supabase 백엔드로 마이그레이션할 때 참고하는 가이드입니다.

---

## 1. 사전 준비

```bash
# Supabase CLI 설치 확인
supabase --version

# 프로젝트 초기화
supabase init
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
```

## 2. 환경 변수 설정

`.env.local`에 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

> service_role key는 서버/Edge Function 전용. 클라이언트에 노출 금지.

## 3. DB 스키마

```sql
-- boards 테이블
create table boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  name text not null,
  icon text default '📋',
  color text default '#6366F1',
  viewport jsonb default '{"x":0,"y":0,"zoom":1}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- modules 테이블
create table modules (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards on delete cascade not null,
  type text not null check (type in ('memo','schedule','image','link')),
  position jsonb not null default '{"x":0,"y":0}',
  size jsonb not null default '{"width":260,"height":200}',
  z_index int default 1,
  color text default 'default',
  is_expanded boolean default false,
  data jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- connections 테이블
create table connections (
  id uuid primary key default gen_random_uuid(),
  board_id uuid references boards on delete cascade not null,
  from_module_id uuid references modules on delete cascade not null,
  to_module_id uuid references modules on delete cascade not null,
  from_anchor text not null,
  to_anchor text not null,
  label text default '',
  style text default 'solid',
  color text default '#94a3b8'
);
```

## 4. RLS 정책

```sql
-- boards: 본인 데이터만 접근
alter table boards enable row level security;
create policy "boards_owner" on boards
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- modules: board 소유자만 접근
alter table modules enable row level security;
create policy "modules_via_board" on modules
  using (exists (
    select 1 from boards where boards.id = modules.board_id
      and boards.user_id = auth.uid()
  ));

-- connections: board 소유자만 접근
alter table connections enable row level security;
create policy "connections_via_board" on connections
  using (exists (
    select 1 from boards where boards.id = connections.board_id
      and boards.user_id = auth.uid()
  ));
```

## 5. 스토어 마이그레이션 (store/canvas.ts)

현재 `loadAppData()` / `createDebouncedSave()` → Supabase 클라이언트 호출로 교체.

```ts
// 예시: addBoard 액션
async addBoard(boardInput) {
  const { data, error } = await supabase
    .from('boards')
    .insert({ ...boardInput, user_id: (await supabase.auth.getUser()).data.user?.id })
    .select()
    .single();
  if (error) throw error;
  set((state) => ({ boards: [...state.boards, mapBoard(data)], activeBoardId: data.id }));
},
```

## 6. 타입 생성

```bash
supabase gen types typescript --linked > types/supabase.ts
```

## 7. 데이터 마이그레이션 (localStorage → Supabase)

```ts
// 앱 최초 실행 시 기존 localStorage 데이터를 Supabase로 업로드
async function migrateLocalDataToSupabase() {
  const raw = localStorage.getItem('mindcanvas_v1');
  if (!raw) return;
  const appData = JSON.parse(raw);
  // boards, modules, connections 순서로 insert
  // 완료 후 localStorage 클리어
  localStorage.removeItem('mindcanvas_v1');
}
```

---

마이그레이션 완료 후 `lib/storage/index.ts`의 localStorage 로직은 제거 또는 폴백으로만 유지합니다.
