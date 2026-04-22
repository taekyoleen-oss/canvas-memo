-- modules.type: 브레인스토밍 모듈 허용

alter table modules
  drop constraint if exists modules_type_check;

alter table modules
  add constraint modules_type_check
  check (type in ('memo', 'schedule', 'image', 'link', 'file', 'brainstorm'));
