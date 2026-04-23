/**
 * 주요 키(환경 변수 이름, localStorage 키 패턴, Supabase 테이블)에 실제 내용이 있는지 요약합니다.
 *
 *   pnpm node scripts/check-main-keys.mjs [user_uuid]
 *
 * user_uuid 생략 시: DB는 전체 건수만, per-user는 EXPORT_USER_ID 환경 변수 사용.
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./_loadEnvLocal.mjs";

const REQUIRED_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const OPTIONAL_ENV = ["NEXT_PUBLIC_APP_URL", "EXPORT_USER_ID"];

const LS_KEYS_DOC = [
  { key: "mindcanvas_v1", desc: "레거시 공용 캔버스 캐시 (비로그인·구버전)" },
  { key: "mindcanvas_v1_u_<userId>", desc: "로그인 계정별 캔버스 JSON (보드·모듈·연결 등)" },
  { key: "mindcanvas_v1_legacy_canvas_migrated", desc: "레거시 마이그레이션 완료 플래그 (1)" },
  { key: "mindcanvas-sidebar-category-collapsed", desc: "사이드바 카테고리 접힘 상태" },
];

async function main() {
  const env = loadEnvLocal();
  const userId = process.argv[2] || env.EXPORT_USER_ID || null;

  console.log("=== 1) .env.local — 변수 존재 여부 (값은 출력 안 함) ===\n");
  for (const k of REQUIRED_ENV) {
    const ok = !!env[k]?.trim();
    console.log(`  ${ok ? "✓" : "✗"} ${k}`);
  }
  for (const k of OPTIONAL_ENV) {
    const ok = !!env[k]?.trim();
    console.log(`  ${ok ? "○" : "·"} ${k} (선택)`);
  }

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log("\n(Supabase 서비스 키 없음 — DB 점검 생략)\n");
    printLocalStorageHelp(userId);
    process.exit(0);
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("\n=== 2) Supabase 테이블 — 행 수 (서비스 롤) ===\n");

  async function count(table, filter) {
    let q = supabase.from(table).select("*", { count: "exact", head: true });
    if (filter) q = q.eq(filter.col, filter.val);
    const { count, error } = await q;
    if (error) return { n: null, err: error.message };
    return { n: count ?? 0, err: null };
  }

  const tables = ["boards", "modules", "connections", "groups"];
  for (const t of tables) {
    const { n, err } = await count(t, null);
    console.log(`  ${t}: ${err ? "오류 " + err : n + "건"}`);
  }

  if (userId) {
    console.log(`\n  — user_id = ${userId} 한정 —`);
    for (const t of tables) {
      const { n, err } = await count(t, { col: "user_id", val: userId });
      console.log(`  ${t}: ${err ? "오류 " + err : n + "건"}`);
    }

    const { data: boards } = await supabase
      .from("boards")
      .select("id,name,board_category")
      .eq("user_id", userId);
    const b = boards ?? [];
    const mc = { memo_schedule: 0, thinking: 0, topic_notes: 0 };
    for (const row of b) {
      const c = row.board_category || "memo_schedule";
      if (mc[c] !== undefined) mc[c]++;
      else mc.memo_schedule++;
    }
    console.log(`\n  보드 ${b.length}개 (카테고리): 메모/할일 ${mc.memo_schedule}, 생각정리 ${mc.thinking}, 주제별 ${mc.topic_notes}`);
  } else {
    console.log("\n  (특정 사용자만 보려면: node scripts/check-main-keys.mjs <uuid> 또는 EXPORT_USER_ID)");
  }

  printLocalStorageHelp(userId);
}

function printLocalStorageHelp(userId) {
  console.log("\n=== 3) 브라우저 localStorage — 앱이 쓰는 주요 키 이름 ===\n");
  for (const { key, desc } of LS_KEYS_DOC) {
    console.log(`  • ${key}`);
    console.log(`    ${desc}`);
  }
  const uKey = userId ? `mindcanvas_v1_u_${userId}` : "mindcanvas_v1_u_<로그인한-UUID>";
  console.log("\n  브라우저에서 내용 확인: 개발자도구 → Application → Local Storage → 해당 origin");
  console.log(`  또는 콘솔에서: Object.keys(localStorage).filter(k => k.includes('mindcanvas'))`);
  console.log(`  계정 키 예: ${uKey}`);
  console.log("  값이 있으면 길이가 0보다 크고, JSON 안에 boards 배열이 있습니다.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
