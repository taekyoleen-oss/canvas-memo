-- 맵 템플릿을 그룹 테이블 없이 모듈 단위로 동기화하기 위한 컬럼.
-- 적용 후 클라이언트 `pushBoardToSupabase`의 modules insert에 map_template_* 필드를
-- 다시 넣으면 Supabase에도 묶음 메타가 저장됩니다(미적용 DB에서는 insert가 실패해 데이터가 비지 않도록 제외됨).
alter table modules add column if not exists map_template_bundle_id uuid null;
alter table modules add column if not exists map_template_id text null;
alter table modules add column if not exists map_pivot jsonb null;
alter table modules add column if not exists map_scale double precision null;
