-- connections 테이블에 연결선 경로 스타일 컬럼 추가
alter table connections add column if not exists path_style text null
  check (path_style in ('bezier','orthogonal','straight'));
