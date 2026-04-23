-- 클로드 코드 → 클로드 표기 통일, 주제별 비시드(🧩 아님) 동명 보드는 메모/할일로 이동

-- 1) 주제별에 잘못 들어간 동명 보드 → memo_schedule (시드 보드는 icon = 🧩 유지)
UPDATE public.boards
SET board_category = 'memo_schedule'
WHERE board_category = 'topic_notes'
  AND COALESCE(icon, '') <> '🧩'
  AND (
    trim(name) IN ('클로드 코드', '클로드')
    OR trim(name) LIKE '% · 클로드 코드'
    OR trim(name) LIKE '%· 클로드 코드'
  )
  AND NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.board_id = boards.id);

-- 2) 보드 이름 치환
UPDATE public.boards
SET name = '클로드'
WHERE trim(name) = '클로드 코드';

UPDATE public.boards
SET name = regexp_replace(trim(name), ' · 클로드 코드$', ' · 클로드')
WHERE trim(name) LIKE '% · 클로드 코드';

UPDATE public.boards
SET name = regexp_replace(trim(name), '· 클로드 코드$', ' · 클로드')
WHERE trim(name) LIKE '%· 클로드 코드'
  AND trim(name) NOT LIKE '% · 클로드';

-- 3) 메모 모듈 제목 (JSON data.title)
UPDATE public.modules
SET data = jsonb_set(data, '{title}', to_jsonb('클로드'::text), true)
WHERE type = 'memo'
  AND trim(coalesce(data->>'title', '')) = '클로드 코드';

UPDATE public.modules
SET data = jsonb_set(
  data,
  '{title}',
  to_jsonb(regexp_replace(trim(data->>'title'), ' · 클로드 코드$', ' · 클로드')),
  true
)
WHERE type = 'memo'
  AND trim(coalesce(data->>'title', '')) LIKE '% · 클로드 코드';

UPDATE public.modules
SET data = jsonb_set(
  data,
  '{title}',
  to_jsonb(regexp_replace(trim(data->>'title'), '· 클로드 코드$', ' · 클로드')),
  true
)
WHERE type = 'memo'
  AND trim(coalesce(data->>'title', '')) LIKE '%· 클로드 코드'
  AND trim(coalesce(data->>'title', '')) NOT LIKE '% · 클로드 코드';
