-- 맵 템플릿 그룹: 템플릿 종류·확대 기준점·누적 배율 (캔버스 UI용)

alter table groups add column if not exists map_template_id text;
alter table groups add column if not exists map_pivot jsonb;
alter table groups add column if not exists map_scale double precision;

comment on column groups.map_template_id is 'BrainstormMapType when group was created from map template';
comment on column groups.map_pivot is '{"x":number,"y":number} canvas pivot for uniform scale';
comment on column groups.map_scale is 'cumulative scale factor for display';
