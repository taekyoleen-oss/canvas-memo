-- add-in Browser 연동: dt_* 테이블 추가 + boards.is_inbox 컬럼
-- Chrome 확장 프로그램(DevToolkit)이 canvas-memo 프로젝트를 공유할 수 있도록

-- ── dt_bookmarks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dt_bookmarks (
  id          TEXT        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  favicon     TEXT,
  "order"     INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dt_bookmarks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dt_bookmarks' AND policyname = 'bookmarks_owner'
  ) THEN
    CREATE POLICY "bookmarks_owner" ON dt_bookmarks
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON dt_bookmarks(user_id);

-- ── dt_scraps ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dt_scraps (
  id                TEXT        PRIMARY KEY,
  user_id           UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type              TEXT        NOT NULL CHECK (type IN ('text', 'image')),
  content           TEXT        NOT NULL,
  source_url        TEXT,
  title             TEXT,
  saved_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- canvas-memo modules 행과 연결 추적용 (삭제·갱신 동기화)
  linked_module_id  UUID        REFERENCES modules(id) ON DELETE SET NULL
);

ALTER TABLE dt_scraps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dt_scraps' AND policyname = 'scraps_owner'
  ) THEN
    CREATE POLICY "scraps_owner" ON dt_scraps
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_scraps_user ON dt_scraps(user_id);

-- ── dt_user_settings ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dt_user_settings (
  user_id     UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  settings    JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE dt_user_settings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dt_user_settings' AND policyname = 'settings_owner'
  ) THEN
    CREATE POLICY "settings_owner" ON dt_user_settings
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- ── boards.is_inbox ───────────────────────────────────────────────────────────
-- 사용자당 1개만 존재하는 받은 메모 보드 식별 플래그

ALTER TABLE boards ADD COLUMN IF NOT EXISTS is_inbox BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_user_inbox
  ON boards(user_id) WHERE is_inbox = TRUE;
