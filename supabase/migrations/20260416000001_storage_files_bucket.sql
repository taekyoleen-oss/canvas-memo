-- files 버킷 생성 및 RLS 정책
-- Supabase 대시보드 SQL Editor에서 실행하세요.

-- 1. 버킷 생성 (이미 있으면 무시)
insert into storage.buckets (id, name, public)
  values ('files', 'files', false)
  on conflict (id) do nothing;

-- 2. 본인 파일만 업로드/조회/삭제 가능
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
