-- 보드 카테고리: 메모·일정 vs 생각정리(브레인스토밍)
alter table boards
  add column if not exists board_category text default 'memo_schedule';

alter table boards
  add column if not exists sidebar_order integer default 0;

update boards set board_category = 'memo_schedule' where board_category is null;

alter table boards
  drop constraint if exists boards_board_category_check;

alter table boards
  add constraint boards_board_category_check
  check (board_category in ('memo_schedule', 'thinking'));
