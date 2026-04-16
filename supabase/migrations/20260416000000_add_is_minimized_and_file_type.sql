-- modules 테이블: is_minimized 컬럼 추가 + file 타입 허용

-- 1. is_minimized 컬럼 추가
alter table modules
  add column if not exists is_minimized boolean not null default false;

-- 2. type 체크 제약 조건에 'file' 추가
--    (기존 제약 삭제 후 재생성)
alter table modules
  drop constraint if exists modules_type_check;

alter table modules
  add constraint modules_type_check
  check (type in ('memo', 'schedule', 'image', 'link', 'file'));
