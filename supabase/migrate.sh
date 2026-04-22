#!/bin/bash
# MindCanvas Supabase 이전 스크립트
# 사용법: 아래 STEP 1 ~ 5를 순서대로 터미널에서 실행하세요.

OLD_REF="wvhwecbwyngnrpkynwze"

echo "========================================"
echo "  MindCanvas DB 이전 스크립트"
echo "========================================"
echo ""

# ── STEP 1: 구 프로젝트 연결 ─────────────────
# 아래 명령 실행 후 Supabase Dashboard > Project Settings > Database > Database password 입력
step1_link_old() {
  echo "[STEP 1] 구 프로젝트 연결..."
  supabase link --project-ref "$OLD_REF"
}

# ── STEP 2: 스키마 + 데이터 덤프 ─────────────
step2_dump() {
  echo "[STEP 2] 스키마 백업..."
  supabase db dump --file supabase/backup_schema.sql
  echo "  → supabase/backup_schema.sql 저장 완료"

  echo "[STEP 2] 데이터 백업..."
  supabase db dump --data-only --file supabase/backup_data.sql
  echo "  → supabase/backup_data.sql 저장 완료"
}

# ── STEP 3: 새 프로젝트 연결 ─────────────────
# 새 프로젝트를 생성한 후 REF를 입력하세요
# https://supabase.com/dashboard → New Project 생성 후 Project Settings > General > Reference ID
step3_link_new() {
  echo "[STEP 3] 새 프로젝트 REF를 입력하세요 (예: abcdefghijklmnop):"
  read -r NEW_REF
  supabase link --project-ref "$NEW_REF"
  echo "NEW_REF=$NEW_REF" > supabase/.new_project_ref
  echo "  → 새 프로젝트 연결 완료"
}

# ── STEP 4: 스키마 적용 (마이그레이션) ────────
step4_push_schema() {
  echo "[STEP 4] 스키마 적용 중..."
  supabase db push
  echo "  → 스키마 적용 완료"
}

# ── STEP 5: 데이터 복원 ──────────────────────
# 새 프로젝트 DB 연결 문자열: Dashboard > Project Settings > Database > Connection string (URI 탭)
# 비밀번호를 직접 URI에 넣거나 PGPASSWORD 환경변수로 설정
step5_restore_data() {
  echo "[STEP 5] 새 DB 연결 문자열을 입력하세요 (postgresql://postgres:PASSWORD@...):"
  read -r NEW_DB_URL
  psql "$NEW_DB_URL" < supabase/backup_data.sql
  echo "  → 데이터 복원 완료"
}

# ── 실행할 STEP 선택 ─────────────────────────
echo "실행할 단계를 선택하세요:"
echo "  1) 구 프로젝트 연결"
echo "  2) 스키마 + 데이터 덤프"
echo "  3) 새 프로젝트 연결"
echo "  4) 스키마 적용 (마이그레이션)"
echo "  5) 데이터 복원"
echo ""
read -r -p "번호 입력: " STEP

case "$STEP" in
  1) step1_link_old ;;
  2) step2_dump ;;
  3) step3_link_new ;;
  4) step4_push_schema ;;
  5) step5_restore_data ;;
  *) echo "1~5 중에 입력하세요." ;;
esac
