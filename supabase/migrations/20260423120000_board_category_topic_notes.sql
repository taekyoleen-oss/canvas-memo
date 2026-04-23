-- 주제별(노트) 워크스페이스
alter table public.boards
  drop constraint if exists boards_board_category_check;

alter table public.boards
  add constraint boards_board_category_check
  check (board_category in ('memo_schedule', 'thinking', 'topic_notes'));
