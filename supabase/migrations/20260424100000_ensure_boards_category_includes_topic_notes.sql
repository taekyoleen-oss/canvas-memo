-- boards.board_category에 topic_notes 허용 (구 DB·일부 환경에서 CHECK만 memo+thinking인 경우 수정)
-- idempotent: 기존에 동일 제약이 있어도 drop 후 재추가

alter table public.boards
  drop constraint if exists boards_board_category_check;

alter table public.boards
  add constraint boards_board_category_check
  check (board_category in ('memo_schedule', 'thinking', 'topic_notes'));
